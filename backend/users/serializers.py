from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "email", "role", "company_id", "lab_id",
            "full_name", "phone", "is_active",
        ]
        # password_hash сознательно не включён — не должен утекать в ответах