from rest_framework import serializers
from .models import Order, OrderItem, Contract, Result


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            "id", "order_id", "device_type", "model", "serial_number", "quantity",
            "custom_fields_schema", "custom_fields_values",
        ]


class OrderSerializer(serializers.ModelSerializer):
    # Только имена — списки показывали "Лаборатория #2" и "Клиент ID: 1",
    # потому что в ответе одни идентификаторы, а справочники страницы больше не
    # грузят. Вложенных объектов не заводим: карточке нужна строка.
    # Связи подтягиваются одним запросом (_orders_for_list, _get_order_or_404) —
    # без select_related каждое из этих полей стоило бы запроса на строку.
    service_name = serializers.CharField(source="service.name", read_only=True)
    lab_name = serializers.CharField(source="lab.name", read_only=True)
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    # Лаборатория, куда заявку направил директор. Связь пустая до направления,
    # поэтому default: без него DRF выкинул бы поле из ответа целиком, и клиент
    # не отличил бы "ещё не назначена" от "поле не пришло".
    assigned_lab_name = serializers.CharField(
        source="assigned_lab.name", read_only=True, default=None
    )

    class Meta:
        model = Order
        fields = [
            "id", "order_number", "client_id", "service_id", "lab_id", "assigned_lab_id",
            "service_name", "lab_name", "client_name", "assigned_lab_name",
            "created_at", "assigned_at", "status", "price", "due_date", "metrologist_id",
            "payment_comment", "client_comment", "manager_comment",
            "invoice_sent", "payment_receipt_name", "receipt_uploaded_at",
            "power_of_attorney_file_name", "tech_documentation_file_name",
            "test_program_draft_file_name", "type_description_draft_file_name",
            "expertise_conclusion",
            "custom_fields_schema", "custom_fields_values",
        ]


class ContractSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contract
        fields = [
            "id", "order_id", "contract_number", "registration_number",
            "file_path", "contract_file_name", "status",
            "director_signed", "director_signed_at", "director_signed_by_id",
            "approver_signed", "approver_signed_at", "approver_signed_by_id",
            "financier_signed", "financier_signed_at", "financier_signed_by_id",
            "client_signed", "client_signed_at", "client_signed_by_id",
            "gen_director_signed", "gen_director_signed_at", "gen_director_signed_by_id",
            "rejected_by_role", "rejected_reason",
            "annulled_at", "annulled_by_id", "annulled_reason",
            "terminated_at", "terminated_by_id", "terminated_reason",
            "created_at",
        ]


class ResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = Result
        fields = ["id", "order_id", "result_type", "issued_at", "file_path", "metrologist_id", "is_signed", "signed_at"]
