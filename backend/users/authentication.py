from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from . import jwt_utils
from .models import User


class JwtAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.headers.get("Authorization")

        if not auth_header or not auth_header.startswith("Bearer "):
            return None

        token = auth_header[7:]

        if not jwt_utils.validate_token(token):
            raise AuthenticationFailed("Invalid or expired token")

        user_id = jwt_utils.get_user_id(token)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise AuthenticationFailed("User not found")

        return (user, token)