import redis
import random
from app.core.config import settings

# Initialize Redis client
redis_client = redis.Redis(
    host=settings.REDIS_URL.split(":")[0],
    port=int(settings.REDIS_URL.split(":")[1]),
    password=settings.REDIS_PASSWORD,
    decode_responses=True # Automatically decode bytes to strings
)

def generate_and_store_otp(email: str, purpose: str, expiry_minutes: int = 5, cooldown_seconds: int = 60) -> str:
    """
    Generates a 6-digit OTP, stores it in Redis with a TTL, and returns the OTP.
    Enforces a cooldown period to prevent spam.
    """
    cooldown_key = f"otp_cooldown:{purpose}:{email}"
    if redis_client.get(cooldown_key):
        raise ValueError("Please wait before requesting another OTP.")

    otp_code = str(random.randint(100000, 999999))
    redis_key = f"otp:{purpose}:{email}"
    
    # Store OTP with TTL
    redis_client.setex(redis_key, expiry_minutes * 60, otp_code)
    # Store Cooldown key
    redis_client.setex(cooldown_key, cooldown_seconds, "1")
    
    return otp_code

def verify_otp(email: str, purpose: str, otp_code: str) -> bool:
    """
    Verifies if the provided OTP matches the one stored in Redis.
    If valid, deletes it to prevent reuse.
    """
    redis_key = f"otp:{purpose}:{email}"
    stored_otp = redis_client.get(redis_key)
    
    if stored_otp and stored_otp == otp_code:
        # OTP is valid, delete it to prevent reuse
        redis_client.delete(redis_key)
        return True
        
    return False
