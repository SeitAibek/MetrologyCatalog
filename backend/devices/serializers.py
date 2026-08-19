from rest_framework import serializers
from .models import Device


class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = [
            "id", "company", "type", "model", "serial_number",
            "last_verified_at", "next_verification_date",
        ]