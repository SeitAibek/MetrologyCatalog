from django.db import models

class Company(models.Model):
    bin = models.CharField(max_length=12, unique=True)
    name = models.CharField(max_length=255)
    address = models.CharField(max_length=255, null=True, blank=True)
    phone = models.CharField(max_length=255, null=True, blank=True)
    email = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        db_table = "companies"

    def __str__(self):
        return self.name