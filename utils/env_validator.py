from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True
    )
    DATABASE_HOST: str = "localhost"
    DATABASE_PORT: int = 5432
    DATABASE_USER: str = "postgres"
    DATABASE_PASSWORD: str = "password"
    DATABASE_NAME: str = "krost"

    ORIGIN: str = "http://localhost"
    HOSTNAME: str = "localhost"


settings = Settings()


@lru_cache()
def get_settings() -> Settings:
    return settings
