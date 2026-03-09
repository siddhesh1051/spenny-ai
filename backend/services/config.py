from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    groq_api_key: str = ""

    whatsapp_verify_token: str = ""
    whatsapp_token: str = ""
    whatsapp_phone_number_id: str = ""

    allowed_origins: str = "http://localhost:5173"

    # Set to "false" in dev when behind a corporate proxy (e.g. Zscaler)
    # that intercepts TLS with a non-RFC-compliant CA cert
    ssl_verify: bool = True

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
