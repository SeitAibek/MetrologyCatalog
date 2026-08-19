from rest_framework.permissions import BasePermission


def has_role(*allowed_roles):
    class _HasRole(BasePermission):
        def has_permission(self, request, view):
            return bool(
                request.user
                and request.user.is_authenticated
                and request.user.role in allowed_roles
            )

    return _HasRole