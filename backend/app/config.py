from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    tutor_db_url: str = "postgresql+psycopg://andriy@localhost:5432/tutor_ib_math"
    orchestrator_url: str = "http://localhost:4700"
    orchestrator_api_key: str = ""
    embedding_agent_url: str = "http://localhost:4705"
    single_user_email: str = "son@example.com"
    single_user_basic_password: str = "changeme"
    backend_host: str = "0.0.0.0"
    backend_port: int = 4800
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
