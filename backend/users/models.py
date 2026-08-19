from django.db import models

class User(models.Model):
    ROLE_CHOICES = [
        ("client", "Client"),
        ("metrolog", "Metrolog"),
        ("manager", "Manager"),
        ("director", "Director"),
        ("gen_director", "General Director"),
        ("financier", "Financier"),
        ("approver", "Approver"),
        ("admin", "Admin"),
    ]

    id_number = models.CharField(max_length=12, unique=True)
    email = models.CharField(max_length=255, null=True, blank=True)
    password_hash = models.CharField(max_length=255)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    company_id = models.IntegerField(null=True, blank=True)
    lab_id = models.IntegerField(null=True, blank=True)
    full_name = models.CharField(max_length=255, null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    password_reset_token = models.CharField(max_length=255, null=True, blank=True)
    password_reset_expires = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "users"

    def __str__(self):
        return self.full_name or self.id_number

    @property
    def is_authenticated(self):
        return True