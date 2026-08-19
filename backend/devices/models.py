from django.db import models

class Device(models.Model):
    company = models.ForeignKey("companies.Company", on_delete=models.CASCADE)
    type = models.CharField(max_length=255)
    model = models.CharField(max_length=255, null=True, blank=True)
    serial_number = models.CharField(max_length=255, unique=True)
    last_verified_at = models.DateTimeField(null=True, blank=True)
    next_verification_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "devices"

    def __str__(self):
        return f"{self.type} ({self.serial_number})"