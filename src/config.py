from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """Настройки приложения"""

    # Основные настройки
    PROJECT_NAME: str = "UniMarket"
    VERSION: str = "0.1.0"
    DEBUG: bool = True
    API_PREFIX: str = "/api/v1"

    model_config = {
        "env_file": ".env",
        "case_sensitive": True
    }

    # API настройки
    API_PREFIX: str = "/api/v1"

    # Для pydantic v2 / pydantic-settings используем model_config
    # (в pydantic v1 использовался вложенный class Config)
    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
    }

# Создаем глобальный объект настроек
settings = Settings()