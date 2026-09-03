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

    def authenticate_header(self, request):
        # Без этого DRF в handle_exception подменяет 401 на 403 для
        # NotAuthenticated/AuthenticationFailed (смотрит на
        # get_authenticate_header(), а он без этого метода возвращает None).
        # Из-за подмены "токен не прислан / протух" неотличимо от "роль не
        # подходит", и фронт не может увести протухшую сессию на логин.
        return "Bearer"