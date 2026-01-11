# 🛒 UniMarket - Fullstack Marketplace API

Современная платформа для объявлений, построенная на FastAPI с автоматическим деплоем и облачной базой данных.

## 🚀 Живое демо
**Ссылка на проект:** [https://unimarket-app.onrender.com](https://unimarket-app.onrender.com)
**API Документация:** [https://unimarket-app.onrender.com/docs](https://unimarket-app.onrender.com/docs)

## 🛠 Технологический стек
* **Backend:** Python 3.13, FastAPI, SQLAlchemy
* **Database:** PostgreSQL (Cloud hosting on Render)
* **Security:** JWT Authentication, Bcrypt password hashing
* **DevOps:** GitHub Actions (CI/CD), Render.com, Docker
* **Frontend:** Vanilla JS, HTML5, CSS3

## 📖 Основные функции
- [x] Регистрация и авторизация пользователей (JWT)
- [x] Создание, просмотр и фильтрация объявлений (Cars)
- [x] Система поддержки пользователей
- [x] Автоматическое тестирование при каждом пуше
- [x] Облачное хранение данных

## 🔧 Как запустить локально
1. Клонируйте репозиторий: `git clone https://github.com/Artur-18-18/UniMarket.git`
2. Установите зависимости: `pip install -r requirements.txt`
3. Запустите сервер: `uvicorn app.main:app --reload`