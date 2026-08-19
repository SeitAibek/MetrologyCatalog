from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Device
from .serializers import DeviceSerializer


@api_view(["GET", "POST"])
def devices_list(request):
    if request.method == "GET":
        company_id = request.query_params.get("companyId")
        if company_id:
            devices = Device.objects.filter(company_id=company_id)
        else:
            devices = Device.objects.all()
        return Response(DeviceSerializer(devices, many=True).data)

    serializer = DeviceSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=201)


@api_view(["GET", "PUT", "DELETE"])
def device_detail(request, id):
    try:
        device = Device.objects.get(id=id)
    except Device.DoesNotExist:
        return Response({"message": "Прибор не найден"}, status=404)

    if request.method == "GET":
        return Response(DeviceSerializer(device).data)

    if request.method == "PUT":
        serializer = DeviceSerializer(device, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    device.delete()
    return Response(status=204)