from fastapi import FastAPI
import sys

# Подключаем настройки гибко: при запуске проекта как пакета используем
# `from src.config import settings`, при запуске как скрипта (python src/main.py)
# sys.path[0] может указывать на папку src, и тогда импорт `src.config` не сработает.
try:
    from src.config import settings
except Exception:
    # fallback — попытаться импортировать локальный модуль `config` (работает при
    # запуске `python src/main.py` из корня проекта)
    from config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Платформа для покупки и продажи товаров между студентами",
    docs_url="/docs",  # Swagger UI
    redoc_url="/redoc"  # ReDoc документация
)

@app.get("/")
async def read_root():
    return {
        "message": "Добро пожаловать в UniMarket!",
        "version": settings.VERSION,
        "docs": "/docs"

    }

@app.get("/health")
async def check_health():
    #Health check endpoint - проверка работоспособности
    return {"status": "ok",
            "project": settings.PROJECT_NAME,
            "version": settings.VERSION
            }

@app.get("/about")
async def about():
    return {
        "project": "UniMarket",
        "description": "Студенческий маркетплейс ФИО",
        "author": "Ваше имя"
    }


# Для запуска сервера используйте CLI: `uvicorn src.main:app --reload`.
# Убрали автоматический вызов uvicorn при прямом запуске скрипта, чтобы
# избежать проблем с reloader-подпроцессами, которые могут не видеть
# пакет `src` (ModuleNotFoundError).
