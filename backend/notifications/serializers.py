from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id", "user_id", "order_id", "message", "notification_type",
            "is_read", "read_at",
        ]