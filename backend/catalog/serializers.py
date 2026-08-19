from rest_framework import serializers
from .models import Service


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = [
            "id", "name", "description", "measurement_type",
            "price", "duration_days", "lab", "is_active", "standard",
        ]