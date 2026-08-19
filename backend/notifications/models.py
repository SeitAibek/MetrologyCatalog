from django.db import models

# notifications/models.py — обновлённые типы
class Notification(models.Model):
    class NotificationType(models.TextChoices):
        ORDER_STATUS = "order_status", "Order Status"
        DOCUMENT_READY = "document_ready", "Document Ready"
        REMINDER = "reminder", "Reminder"
        APPROVAL_REQUIRED = "approval_required", "Approval Required"
        PAYMENT_RECEIVED = "payment_received", "Payment Received"
        ASSIGNED_TO_LAB = "assigned_to_lab", "Assigned To Lab"
        RECEIPT_UPLOADED = "receipt_uploaded", "Receipt Uploaded"

    user = models.ForeignKey("users.User", on_delete=models.CASCADE)
    order = models.ForeignKey("orders.Order", on_delete=models.CASCADE, null=True, blank=True)
    message = models.CharField(max_length=255)
    notification_type = models.CharField(max_length=20, choices=NotificationType.choices, null=True, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "notifications"

    def __str__(self):
        return self.message