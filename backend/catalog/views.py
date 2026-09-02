from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from users.permissions import has_role
from .models import Service
from .serializers import ServiceSerializer

ALLOWED_FIELD_TYPES = {"text", "textarea", "number", "date", "select"}
ALLOWED_FIELD_SCOPES = {"item", "order"}


def _validate_custom_fields_schema(schema):
    # Кривая схема, попавшая в БД, сломает рендер формы и валидацию заявки
    # разом у всех клиентов этой услуги — поэтому проверяем строго на входе,
    # а не полагаемся на то, что менеджер соберёт её через UI без ошибок.
    if not isinstance(schema, list):
        return "Схема должна быть списком полей"

    seen_keys = set()
    for field in schema:
        if not isinstance(field, dict):
            return "Каждое поле схемы должно быть объектом"

        key = field.get("key")
        if not isinstance(key, str) or not key.strip():
            return "У поля должен быть непустой key"
        if key in seen_keys:
            return f"Ключ «{key}» повторяется в схеме"
        seen_keys.add(key)

        if field.get("type") not in ALLOWED_FIELD_TYPES:
            return f"Недопустимый тип поля «{key}»: {field.get('type')}"
        if field.get("scope") not in ALLOWED_FIELD_SCOPES:
            return f"Недопустимый scope поля «{key}»: {field.get('scope')}"
        if field.get("type") == "select" and not field.get("options"):
            return f"У поля-списка «{key}» должны быть options"

    return None


@api_view(["GET"])
def get_all_services(request):
    services = Service.objects.filter(is_active=True)
    serializer = ServiceSerializer(services, many=True)
    return Response(serializer.data)


@api_view(["GET"])
def get_service_by_id(request, id):
    try:
        service = Service.objects.get(id=id, is_active=True)
    except Service.DoesNotExist:
        return Response({"message": "Услуга не найдена"}, status=404)

    serializer = ServiceSerializer(service)
    return Response(serializer.data)


@api_view(["GET"])
def get_by_measurement_type(request, measurement_type):
    services = Service.objects.filter(measurement_type=measurement_type, is_active=True)
    serializer = ServiceSerializer(services, many=True)
    return Response(serializer.data)


@api_view(["GET"])
def get_by_lab_id(request, lab_id):
    services = Service.objects.filter(lab_id=lab_id, is_active=True)
    serializer = ServiceSerializer(services, many=True)
    return Response(serializer.data)


@api_view(["PUT"])
@permission_classes([has_role("manager")])
def update_service_template(request, id):
    try:
        service = Service.objects.get(id=id)
    except Service.DoesNotExist:
        return Response({"message": "Услуга не найдена"}, status=404)

    schema = request.data.get("custom_fields_schema")
    if schema is None:
        schema = []

    error = _validate_custom_fields_schema(schema)
    if error:
        return Response({"message": error}, status=400)

    service.custom_fields_schema = schema
    service.save(update_fields=["custom_fields_schema"])

    return Response(ServiceSerializer(service).data)