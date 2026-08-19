from django.db import models

class Message(models.Model):
    order = models.ForeignKey("orders.Order", on_delete=models.CASCADE)
    sender = models.ForeignKey("users.User", on_delete=models.CASCADE)
    sender_role = models.CharField(max_length=20)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "messages"

    def __str__(self):
        return f"Message #{self.pk} on Order #{self.order_id}"