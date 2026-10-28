from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: Optional[str] = None
    supabase_service_key: Optional[str] = None
    database_url: Optional[str] = None
    jwt_secret: str = "ecourt-super-secret-jwt-key-2026-secure"
    jwt_alg: str = "HS256"
    jwt_expire_minutes: int = 60
    llm_provider: str = "groq"
    groq_api_key: str
    groq_model_name: str = "qwen/qwen3.8-27b"
    cors_origins: str = "http://localhost:5173"


settings = Settings()
