from rest_framework import serializers
from .models import Order, OrderItem, Contract, Result


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = [
            "id", "order_id", "device_type", "model", "serial_number", "quantity",
            "manufacturer_name", "manufacturer_address", "manufacturer_country",
            "metrological_characteristics",
        ]


class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = [
            "id", "order_number", "client_id", "service_id", "lab_id", "assigned_lab_id",
            "assigned_at", "status", "price", "due_date", "metrologist_id",
            "payment_comment", "client_comment", "manager_comment",
            "invoice_sent", "payment_receipt_name", "receipt_uploaded_at",
            "power_of_attorney_file_name", "tech_documentation_file_name",
            "test_program_draft_file_name", "type_description_draft_file_name",
            "expertise_conclusion",
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
