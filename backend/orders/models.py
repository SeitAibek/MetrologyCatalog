from django.db import models


class Order(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING_CONTRACT = "pending_contract", "Pending Contract"
        REVISION = "revision", "Revision"
        AWAITING_APPROVAL = "awaiting_approval", "Awaiting Approval"
        AWAITING_PAYMENT = "awaiting_payment", "Awaiting Payment"
        PENDING_DELIVERY = "pending_delivery", "Pending Delivery"
        AWAITING_DELIVERY = "awaiting_delivery", "Awaiting Delivery"
        RECEIVED_IN_LAB = "received_in_lab", "Received In Lab"
        EXPERTISE = "expertise", "Expertise"
        IN_WORK = "in_work", "In Work"
        UNDER_REVIEW = "under_review", "Under Review"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        ANNULLED = "annulled", "Annulled"
        TERMINATED = "terminated", "Terminated"

    order_number = models.CharField(max_length=255, unique=True)
    client = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="orders_as_client")
    service = models.ForeignKey("catalog.Service", on_delete=models.CASCADE)
    lab = models.ForeignKey("laboratories.Laboratory", on_delete=models.CASCADE)
    assigned_lab = models.ForeignKey(
        "laboratories.Laboratory", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="orders_assigned"
    )
    assigned_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.PENDING_CONTRACT)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    metrologist = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="orders_as_metrologist"
    )
    payment_comment = models.TextField(null=True, blank=True)
    client_comment = models.TextField(null=True, blank=True)
    manager_comment = models.TextField(null=True, blank=True)
    invoice_sent = models.BooleanField(default=False)
    payment_receipt = models.TextField(null=True, blank=True)
    payment_receipt_name = models.CharField(max_length=255, null=True, blank=True)
    receipt_uploaded_at = models.DateTimeField(null=True, blank=True)

    # Заявитель прикладывает на шаге подачи заявки (форма Казстандарта); nullable —
    # чтобы заявки, созданные до появления этих полей, не требовали бэкфилла.
    power_of_attorney_file = models.TextField(null=True, blank=True)
    power_of_attorney_file_name = models.CharField(max_length=255, null=True, blank=True)
    tech_documentation_file = models.TextField(null=True, blank=True)
    tech_documentation_file_name = models.CharField(max_length=255, null=True, blank=True)

    # Заполняется назначенным метрологом на этапе экспертизы (expertise -> in_work).
    test_program_draft_file = models.TextField(null=True, blank=True)
    test_program_draft_file_name = models.CharField(max_length=255, null=True, blank=True)
    type_description_draft_file = models.TextField(null=True, blank=True)
    type_description_draft_file_name = models.CharField(max_length=255, null=True, blank=True)
    expertise_conclusion = models.TextField(null=True, blank=True)

    # Поля шаблона услуги с scope="order" (общие для заявки, а не для
    # конкретного прибора) — сегодня ни у одной услуги таких нет, задел на
    # будущее, симметричный custom_fields_* на OrderItem.
    custom_fields_schema = models.JSONField(default=list, blank=True)
    custom_fields_values = models.JSONField(default=dict, blank=True)

    # Момент подачи. null=True не ради новых заявок — им дату проставит
    # auto_now_add, — а ради заведённых до появления колонки: у части из них
    # даты нет и взять её неоткуда, и пустое поле честнее, чем момент
    # применения миграции, выданный за дату подачи.
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        db_table = "orders"

    def __str__(self):
        return self.order_number

class OrderItem(models.Model):
    order = models.ForeignKey("orders.Order", on_delete=models.CASCADE)
    device_type = models.CharField(max_length=255)
    model = models.CharField(max_length=255, null=True, blank=True)
    serial_number = models.CharField(max_length=255)
    quantity = models.IntegerField()

    # Устарело — заменено на custom_fields_schema/custom_fields_values ниже.
    # Колонки остаются nullable для уже существующих строк, но больше не
    # заполняются новыми заявками.
    manufacturer_name = models.CharField(max_length=255, null=True, blank=True)
    manufacturer_address = models.CharField(max_length=255, null=True, blank=True)
    manufacturer_country = models.CharField(max_length=255, null=True, blank=True)
    metrological_characteristics = models.TextField(null=True, blank=True)

    # Поля, специфичные для услуги (шаблон в Service.custom_fields_schema).
    # schema — снимок шаблона на момент записи позиции, не текущий шаблон
    # услуги: старые заявки должны отображаться так же, как были заполнены,
    # даже если менеджер потом изменил шаблон.
    custom_fields_schema = models.JSONField(default=list, blank=True)
    custom_fields_values = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "order_items"

    def __str__(self):
        return f"{self.device_type} ({self.serial_number})"


class Result(models.Model):
    class ResultType(models.TextChoices):
        CERTIFICATE = "certificate", "Certificate"
        PROTOCOL = "protocol", "Protocol"
        REPORT = "report", "Report"

    order = models.ForeignKey("orders.Order", on_delete=models.CASCADE)
    result_type = models.CharField(max_length=20, choices=ResultType.choices, null=True, blank=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    file_path = models.CharField(max_length=255, null=True, blank=True)
    metrologist = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="results_as_metrologist")
    is_signed = models.BooleanField(default=False)
    signed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "results"

    def __str__(self):
        return f"Result #{self.pk} for Order #{self.order_id}"


class Contract(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PENDING_APPROVAL = "pending_approval", "Pending Approval"
        APPROVED = "approved", "Approved"
        SIGNED = "signed", "Signed"
        REJECTED = "rejected", "Rejected"
        ANNULLED = "annulled", "Annulled"
        TERMINATED = "terminated", "Terminated"

    order = models.OneToOneField("orders.Order", on_delete=models.CASCADE)
    contract_number = models.CharField(max_length=255, unique=True)
    registration_number = models.CharField(max_length=255, null=True, blank=True)
    file_path = models.CharField(max_length=255, null=True, blank=True)
    contract_file = models.TextField(null=True, blank=True)
    contract_file_name = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)

    director_signed = models.BooleanField(default=False)
    director_signed_at = models.DateTimeField(null=True, blank=True)
    director_signed_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="contracts_signed_as_director"
    )

    approver_signed = models.BooleanField(default=False)
    approver_signed_at = models.DateTimeField(null=True, blank=True)
    approver_signed_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="contracts_signed_as_approver"
    )

    financier_signed = models.BooleanField(default=False)
    financier_signed_at = models.DateTimeField(null=True, blank=True)
    financier_signed_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="contracts_signed_as_financier"
    )

    client_signed = models.BooleanField(default=False)
    client_signed_at = models.DateTimeField(null=True, blank=True)
    client_signed_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="contracts_signed_as_client"
    )

    gen_director_signed = models.BooleanField(default=False)
    gen_director_signed_at = models.DateTimeField(null=True, blank=True)
    gen_director_signed_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="contracts_signed_as_gen_director"
    )

    rejected_by_role = models.CharField(max_length=50, null=True, blank=True)
    rejected_reason = models.TextField(null=True, blank=True)

    annulled_at = models.DateTimeField(null=True, blank=True)
    annulled_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="contracts_annulled"
    )
    annulled_reason = models.CharField(max_length=255, null=True, blank=True)

    terminated_at = models.DateTimeField(null=True, blank=True)
    terminated_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="contracts_terminated"
    )
    terminated_reason = models.CharField(max_length=255, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "contracts"

    def __str__(self):
        return self.contract_number

    @property
    def is_trio_signed(self):
        return self.director_signed and self.approver_signed and self.financier_signed

    @property
    def is_fully_signed(self):
        return self.is_trio_signed and self.client_signed and self.gen_director_signed

    def reset_approval_state(self):
        self.approver_signed = False
        self.approver_signed_at = None
        self.approver_signed_by = None
        self.financier_signed = False
        self.financier_signed_at = None
        self.financier_signed_by = None
        self.director_signed = False
        self.director_signed_at = None
        self.director_signed_by = None
        self.client_signed = False
        self.client_signed_at = None
        self.client_signed_by = None
        self.gen_director_signed = False
        self.gen_director_signed_at = None
        self.gen_director_signed_by = None
        self.rejected_by_role = None
        self.rejected_reason = None