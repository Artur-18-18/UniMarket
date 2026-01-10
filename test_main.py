from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_read_main():
    """Проверка доступности API (Health Check)"""
    # Поскольку у нас нет корневого GET /, проверим 404 или добавим эндпоинт.
    # Проверим эндпоинт авторизации без данных (должен вернуть 422 Validation Error, значит сервер жив)
    response = client.post("/auth/token")
    assert response.status_code in [422, 401]