# Используем легкий образ Python
FROM python:3.9-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем зависимости и устанавливаем их
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь код проекта
COPY . .

# Команда запуска. Используем переменную PORT (нужна для Render/Railway) или 8000 по умолчанию
# Также слушаем 0.0.0.0, чтобы быть доступными извне контейнера
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]