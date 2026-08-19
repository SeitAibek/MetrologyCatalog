from rest_framework import serializers
from .models import Order, OrderItem, Contract, Result


class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["id", "order", "device_type", "model", "serial_number", "quantity"]


class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = [
            "id", "order_number", "client", "service", "lab", "assigned_lab",
            "assigned_at", "status", "price", "due_date", "metrologist",
            "payment_comment", "client_comment", "manager_comment",
            "invoice_sent", "payment_receipt_name", "receipt_uploaded_at",
        ]


class ContractSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contract
        fields = [
            "id", "order", "contract_number", "registration_number",
            "file_path", "contract_file_name", "status",
            "director_signed", "director_signed_at", "director_signed_by",
            "approver_signed", "approver_signed_at", "approver_signed_by",
            "financier_signed", "financier_signed_at", "financier_signed_by",
            "client_signed", "client_signed_at", "client_signed_by",
            "gen_director_signed", "gen_director_signed_at", "gen_director_signed_by",
            "rejected_by_role", "rejected_reason",
            "annulled_at", "annulled_by", "annulled_reason",
            "terminated_at", "terminated_by", "terminated_reason",
            "created_at",
        ]


class ResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = Result
        fields = ["id", "order", "result_type", "issued_at", "file_path", "metrologist", "is_signed", "signed_at"]