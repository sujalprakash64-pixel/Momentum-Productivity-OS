from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Momentum Productivity OS"
    environment: str = "development"
    frontend_origin: str = "http://localhost:3000"
    cors_origins: str = ""
    database_url: str = "postgresql+asyncpg://momentum:momentum@postgres:5432/momentum"
    redis_url: str = "redis://redis:6379/0"
    auto_create_tables: bool = True
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 1440
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"
    whatsapp_provider: str = "cloud"
    whatsapp_verify_token: str = "dev-verify-token"
    whatsapp_cloud_token: str = ""
    whatsapp_phone_number_id: str = ""
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from: str = "whatsapp:+14155238886"
    default_timezone: str = "Asia/Kolkata"

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return self.database_url

    @property
    def allowed_origins(self) -> list[str]:
        origins = [self.frontend_origin]
        if self.cors_origins:
            origins.extend([origin.strip() for origin in self.cors_origins.split(",") if origin.strip()])
        return list(dict.fromkeys(origins))


@lru_cache
def get_settings() -> Settings:
    return Settings()
