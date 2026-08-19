from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Service
from .serializers import ServiceSerializer


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