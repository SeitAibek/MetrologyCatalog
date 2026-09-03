from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from users.permissions import has_role
from .models import Device
from .serializers import DeviceSerializer


@api_view(["GET", "POST"])
@permission_classes([has_role("client", "manager")])
def devices_list(request):
    if request.method == "GET":
        # Для клиента companyId из запроса ничего не решает: он видит приборы
        # только своей компании. Менеджеру этот параметр сужает выборку внутри
        # того, что ему и так доступно — там он остаётся фильтром.
        if request.user.role == "client":
            devices = Device.objects.filter(company_id=request.user.company_id)
        else:
            company_id = request.query_params.get("companyId")
            devices = (
                Device.objects.filter(company_id=company_id) if company_id
                else Device.objects.all()
            )
        return Response(DeviceSerializer(devices, many=True).data)

    serializer = DeviceSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    # Симметрично чтению: клиент заводит прибор только своей компании, каким бы
    # company_id ни было в теле запроса.
    if request.user.role == "client":
        serializer.save(company_id=request.user.company_id)
    else:
        serializer.save()
    return Response(serializer.data, status=201)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([has_role("client", "manager")])
def device_detail(request, id):
    try:
        device = Device.objects.get(id=id)
    except Device.DoesNotExist:
        return Response({"message": "Прибор не найден"}, status=404)

    # Прямой доступ по id — та же граница, что и в списке: чужой прибор для
    # клиента не существует (404, а не 403 — id чужих компаний не подтверждаем).
    if request.user.role == "client" and device.company_id != request.user.company_id:
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