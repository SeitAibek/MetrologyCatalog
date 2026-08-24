from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    active = serializers.BooleanField(source="is_active")

    class Meta:
        model = User
        fields = [
            "id", "id_number", "email", "role", "company_id", "lab_id",
            "full_name", "phone", "active",
        ]