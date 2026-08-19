from django.db import models

class Service(models.Model):
    name = models.CharField(max_length=255)
    description = models.CharField(max_length=255, null=True, blank=True)
    measurement_type = models.CharField(max_length=255, null=True, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    duration_days = models.IntegerField()
    lab = models.ForeignKey("laboratories.Laboratory", on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)
    standard = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = "services"

    def __str__(self):
        return self.name