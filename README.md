# UniMarket
Student marketplace platform built with FastAPI
# UniMarket
Платформа для покупки и продажи товаров между студентами университета.
## Технологии
- **Backend**: FastAPI 0.104+
- **Database**: PostgreSQL + SQLAlchemy
- **Python**: 3.10+
## Установка
1. Клонируйте репозиторий:
```bash
git clone https://github.com/YOUR_USERNAME/UniMarket.git
cd UniMarket
2. Создайте виртуальное окружение:
python -m venv venv
source venv/bin/activate # Mac/Linux
venv\Scripts\activate # Windows
3. Установите зависимости:
pip install -r requirements.txt
4. Создайте файл .env:
PROJECT_NAME=UniMarket
VERSION=0.1.0
DEBUG=True
5. Запустите сервер:
python src/main.py
6. Откройте документацию:
• Swagger UI: http://localhost:8000/docs
• ReDoc: http://localhost:8000/redoc
