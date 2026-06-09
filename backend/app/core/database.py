from supabase import create_client, Client
from app.core.config import get_settings
from functools import lru_cache

settings = get_settings()


@lru_cache()
def get_supabase() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)


@lru_cache()
def get_supabase_admin() -> Client:
    """Service role client — bypasses RLS. Use only for server-side operations."""
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
