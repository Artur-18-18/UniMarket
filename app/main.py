import os, shutil, uuid
from fastapi import FastAPI, Depends, HTTPException, Form, UploadFile, File, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List
from pathlib import Path

from app.database import engine, Base, get_db
from app.models.user import User
from app.models.car import Car
from app.models.purchase import Purchase
from app.schemas.order import OrderCreate, PurchaseOut
from app.models.message import Message
from app.schemas.user import UserUpdateSchema
from app.schemas.message import MessageCreate, MessageOut
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.auth import get_current_user
from typing import Optional

# Создаем таблицы (импорт моделей выше гарантирует регистрацию метаданных)
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Разрешаем CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Монтируем папки для статики
os.makedirs("uploads", exist_ok=True)
os.makedirs("static/avatars", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
app.mount("/static", StaticFiles(directory="static"), name="static")

# --- AUTH ---
@app.post("/auth/register")
def register(username: str = Form(...), email: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    import traceback
    try:
        if db.query(User).filter(User.username == username).first():
            raise HTTPException(400, "User already exists")
        new_user = User(username=username, email=email, hashed_password=get_password_hash(password), role="user")
        db.add(new_user)
        db.commit()
        return {"message": "Success"}
    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        # Return a controlled error to help debugging during development
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/auth/token")
def login(username: str = Form(...), password: str = Form(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(401, "Invalid credentials")
    return {"access_token": create_access_token({"sub": user.username}), "token_type": "bearer"}

@app.get("/auth/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.patch("/auth/profile")
def update_profile(payload: UserUpdateSchema, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Проверяем уникальность
    if payload.username:
        exists = db.query(User).filter(User.username == payload.username, User.id != current_user.id).first()
        if exists:
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = payload.username

    if payload.email:
        exists = db.query(User).filter(User.email == payload.email, User.id != current_user.id).first()
        if exists:
            raise HTTPException(status_code=400, detail="Email already taken")
        current_user.email = payload.email

    db.commit()
    return {"id": current_user.id, "username": current_user.username, "email": current_user.email, "avatar_url": current_user.avatar_url}

# --- CARS ---
@app.post("/cars/")
async def create_car(
    brand: str = Form(...),
    model: str = Form(...),
    price: float = Form(...),
    year: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Сохранение фото машины
    file_ext = Path(file.filename).suffix
    file_name = f"{uuid.uuid4()}{file_ext}"
    file_path = f"uploads/{file_name}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    new_car = Car(
        brand=brand, model=model, price=price, year=year,
        image_url=file_path, owner_id=current_user.id
    )
    db.add(new_car)
    db.commit()
    db.refresh(new_car)
    return new_car

@app.get("/cars/", response_model=List[dict])
def list_cars(db: Session = Depends(get_db)):
    cars = db.query(Car).all()
    return [{
        "id": c.id,
        "brand": c.brand,
        "model": c.model,
        "price": c.price,
        "year": c.year,
        "image_url": c.image_url,
        "owner_id": c.owner_id,
        "is_sold": getattr(c, 'is_sold', False)
    } for c in cars]

# --- AVATAR ---
@app.post("/auth/avatar")
async def upload_avatar(file: UploadFile = File(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ext = Path(file.filename).suffix
    filename = f"avatar_{current_user.id}{ext}"
    path = f"static/avatars/{filename}"
    
    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    current_user.avatar_url = path
    db.commit()
    # Return web-accessible path starting with slash so frontend can load it as /static/...
    return {"avatar_url": f"/{path}"}

# --- MESSAGES / SUPPORT ---
@app.post("/support/messages/", response_model=MessageOut)
def create_message(payload: MessageCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Создать новое сообщение от пользователя к службе поддержки."""
    msg = Message(user_id=current_user.id, sender="user", content=payload.content)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


@app.get("/support/messages/me", response_model=List[MessageOut])
def get_my_messages(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Получить список сообщений текущего пользователя (включая ответы службы поддержки)."""
    messages = db.query(Message).filter(Message.user_id == current_user.id).order_by(Message.created_at.desc()).all()
    return messages


@app.post("/support/messages/{message_id}/reply", response_model=MessageOut)
def reply_message(message_id: int, payload: MessageCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Ответ на сообщение. По упрощённой логике только пользователь-отправитель или аккаунт 'support' может добавлять ответ.
    Если ответ добавляет служба поддержки (username == 'support'), исходное сообщение помечается как прочитанное.
    """
    orig = db.query(Message).filter(Message.id == message_id).first()
    if not orig:
        raise HTTPException(status_code=404, detail="Message not found")

    # Разрешаем ответ только автору сообщения или пользователю с ролью support/admin
    user_role = getattr(current_user, 'role', None)
    if user_role not in ("support", "admin") and current_user.id != orig.user_id:
        raise HTTPException(status_code=403, detail="No permission to reply")

    sender = "support" if current_user.username == "support" else "user"
    reply = Message(user_id=orig.user_id, sender=sender, content=payload.content)
    db.add(reply)
    if sender == "support":
        orig.is_read = True
    db.commit()
    db.refresh(reply)
    return reply


def _is_admin_or_support(user: User) -> bool:
    role = getattr(user, 'role', None)
    # Backwards compatible: allow username 'admin' or 'support' as well
    if role in ("admin", "support"):
        return True
    if getattr(user, 'username', None) in ("admin", "support"):
        return True
    return False


@app.get("/admin/messages", response_model=List[MessageOut])
def admin_get_all_messages(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not _is_admin_or_support(current_user):
        raise HTTPException(status_code=403, detail="No permission")
    msgs = db.query(Message).order_by(Message.created_at.desc()).all()
    return msgs


@app.patch("/admin/users/{user_id}/role")
def admin_set_role(user_id: int, role: str = Form(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Set role for a user. role should be one of: user, support, admin. Only admin/support can perform this (support can set support role).
    For safety, only admin can assign admin role."""
    if not _is_admin_or_support(current_user):
        raise HTTPException(status_code=403, detail="No permission")

    if role not in ("user", "support", "admin"):
        raise HTTPException(status_code=400, detail="Invalid role")

    # Only admin can assign admin
    if role == "admin" and getattr(current_user, 'role', None) != "admin":
        raise HTTPException(status_code=403, detail="Only admin can assign admin role")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = role
    db.commit()
    return {"id": user.id, "username": user.username, "role": user.role}

@app.delete("/cars/{car_id}")
def delete_car(car_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    car = db.query(Car).filter(Car.id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Машина не найдена")
    
    # Разрешаем удаление, если владелец не указан (старые записи) ИЛИ если это ваш ID
    if car.owner_id is not None and car.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Это не ваше авто")
    
    db.delete(car)
    db.commit()
    return {"message": "Удалено"}

# --- BACKGROUND TASKS ---
def send_email_notification(email: str, subject: str, message: str):
    """Фоновая задача: имитация отправки email."""
    import time
    # Имитируем задержку сети (например, подключение к SMTP серверу)
    time.sleep(2)
    with open("email_log.txt", "a", encoding="utf-8") as f:
        f.write(f"TO: {email}\nSUBJECT: {subject}\nMESSAGE: {message}\n{'-'*30}\n")
    print(f"[Background] Email sent to {email}")

def cleanup_system_data():
    """Фоновая задача: очистка временных данных."""
    print("[Background] System cleanup started...")
    # Здесь могла бы быть логика удаления старых логов или временных файлов
    print("[Background] System cleanup finished.")

# --- ORDERS / PURCHASES ---
@app.post("/orders/", response_model=List[PurchaseOut])
def create_order(payload: OrderCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create purchases for given car ids. Marks cars as sold if available."""
    purchases = []
    purchased_titles = []

    for car_id in payload.items:
        car = db.query(Car).filter(Car.id == car_id).first()
        if not car:
            raise HTTPException(status_code=404, detail=f"Car {car_id} not found")
        if getattr(car, 'is_sold', False):
            raise HTTPException(status_code=400, detail=f"Car {car_id} already sold")

        # create purchase
        p = Purchase(car_id=car.id, buyer_id=current_user.id, price=car.price)
        db.add(p)
        # mark car as sold
        car.is_sold = True
        db.commit()
        db.refresh(p)
        purchases.append(p)
        purchased_titles.append(f"{car.brand} {car.model}")

    # Добавляем фоновые задачи, если покупка состоялась
    if purchases:
        # 1. Отправка уведомления покупателю
        msg = f"Поздравляем с покупкой! Ваши авто: {', '.join(purchased_titles)}"
        background_tasks.add_task(send_email_notification, current_user.email, "Подтверждение заказа UniMarket", msg)
        
        # 2. Запуск очистки (например, удаление кэша или старых сессий)
        background_tasks.add_task(cleanup_system_data)

    return purchases

# --- REPORTS (ADMIN) ---
@app.get("/admin/reports/users")
def report_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Список пользователей с краткой статистикой активности."""
    if not _is_admin_or_support(current_user):
        raise HTTPException(status_code=403, detail="No permission")
    
    users = db.query(User).all()
    result = []
    for u in users:
        # Считаем количество машин и покупок (прямым запросом, если нет relationship)
        cars_count = db.query(Car).filter(Car.owner_id == u.id).count()
        purchases_count = db.query(Purchase).filter(Purchase.buyer_id == u.id).count()
        
        result.append({
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "cars_count": cars_count,
            "purchases_count": purchases_count
        })
    return result

@app.get("/admin/reports/items")
def report_items(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Статистика по товарам: самые дорогие и популярные."""
    if not _is_admin_or_support(current_user):
        raise HTTPException(status_code=403, detail="No permission")
    
    # Топ-5 самых дорогих (не проданных)
    expensive = db.query(Car).filter(Car.is_sold == False).order_by(Car.price.desc()).limit(5).all()
    
    return {
        "expensive_active": [{"brand": c.brand, "model": c.model, "price": c.price} for c in expensive]
    }

@app.get("/admin/reports/categories")
def report_categories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Количество объявлений по маркам (категориям)."""
    if not _is_admin_or_support(current_user):
        raise HTTPException(status_code=403, detail="No permission")
    
    stats = db.query(Car.brand, func.count(Car.id)).group_by(Car.brand).all()
    return [{"category": brand, "count": count} for brand, count in stats]

# --- WEBSOCKETS CHAT ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@app.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str, db: Session = Depends(get_db)):
    await manager.connect(websocket)
    try:
        # 1. При подключении отправляем историю (последние 50 сообщений)
        history = db.query(Message).order_by(Message.created_at.desc()).limit(50).all()
        # Разворачиваем, чтобы старые были сверху
        for msg in reversed(history):
            sender_name = "Support"
            if msg.sender == "user" and msg.user:
                sender_name = msg.user.username
            elif msg.sender == "user":
                sender_name = "User"
            
            await websocket.send_text(f"{sender_name}: {msg.content}")

        # 2. Слушаем новые сообщения
        while True:
            data = await websocket.receive_text()
            
            # Сохраняем в БД
            user = db.query(User).filter(User.username == username).first()
            if user:
                new_msg = Message(user_id=user.id, sender="user", content=data)
                db.add(new_msg)
                db.commit()
                # Рассылаем всем с именем отправителя
                await manager.broadcast(f"{username}: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)