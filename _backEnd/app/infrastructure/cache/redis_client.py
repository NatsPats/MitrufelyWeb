"""
Mifrufely Web — Redis Client
Async Redis connection prepared for caching and Celery
"""

from redis.asyncio import Redis, from_url

from app.core.config import settings

redis_client: Redis = from_url(  # type: ignore[assignment]
    settings.REDIS_URL,
    encoding="utf-8",
    decode_responses=True,
)


async def get_redis() -> Redis:
    """FastAPI dependency for Redis client."""
    return redis_client
