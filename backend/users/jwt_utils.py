import jwt
from datetime import datetime, timedelta, timezone
from django.conf import settings


def generate_token(user_id: int, email: str, role: str, lab_id: int | None) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "labId": lab_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(milliseconds=settings.JWT_EXPIRATION_MS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def get_claims(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])


def get_user_id(token: str) -> int:
    return int(get_claims(token)["sub"])


def get_lab_id(token: str) -> int | None:
    return get_claims(token).get("labId")


def validate_token(token: str) -> bool:
    try:
        get_claims(token)
        return True
    except jwt.PyJWTError:
        return False