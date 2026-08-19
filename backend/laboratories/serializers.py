from rest_framework import serializers
from .models import Laboratory


class LabSerializer(serializers.ModelSerializer):
    class Meta:
        model = Laboratory
        fields = ["id", "name", "address", "phone", "city", "email"]