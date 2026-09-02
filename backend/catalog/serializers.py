from rest_framework import serializers
from .models import Service


class ServiceSerializer(serializers.ModelSerializer):
    lab_name = serializers.CharField(source="lab.name", read_only=True)

    class Meta:
        model = Service
        fields = [
            "id", "name", "description", "measurement_type",
            "price", "duration_days", "lab_id", "lab_name", "is_active", "standard",
            "custom_fields_schema",
        ]