from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/mealplan"
    openai_api_key: str = ""
    openai_base_url: str = ""
    llm_fast_model: str = "openai/gpt-4o-mini"
    llm_heavy_model: str = "openai/gpt-4o"
    llm_concurrency: int = 5
    debug: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
