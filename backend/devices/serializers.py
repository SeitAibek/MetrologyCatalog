from rest_framework import serializers
from companies.models import Company
from .models import Device


class DeviceSerializer(serializers.ModelSerializer):
    company_id = serializers.PrimaryKeyRelatedField(source="company", queryset=Company.objects.all())

    class Meta:
        model = Device
        fields = [
            "id", "company_id", "type", "model", "serial_number",
            "last_verified_at", "next_verification_date",
        ]