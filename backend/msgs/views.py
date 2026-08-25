from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Message
from .serializers import MessageSerializer
from orders.models import Order
from users.permissions import has_role
from notifications import services as notification_services


@api_view(["GET", "POST"])
@permission_classes([has_role("client", "manager", "metrolog")])
def messages_by_order(request, order_id):
    if request.method == "GET":
        messages = Message.objects.filter(order_id=order_id).order_by("created_at")
        return Response(MessageSerializer(messages, many=True).data)

    # POST
    text = (request.data.get("text") or "").strip()

    if not text:
        return Response({"message": "Текст сообщения не может быть пустым"}, status=400)
    if len(text) > 2000:
        return Response({"message": "Сообщение слишком длинное"}, status=400)

    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return Response({"message": "Заявка не найдена"}, status=404)

    sender = request.user

    message = Message.objects.create(
        order=order,
        sender=sender,
        sender_role=sender.role,
        text=text,
    )

    if sender.role == "client":
        notification_services.notify_managers_new_message(order_id, order.order_number, sender.full_name)
    elif sender.role in ("manager", "metrolog"):
        notification_services.notify_client_new_message(order.client_id, order_id, order.order_number)

    return Response(MessageSerializer(message).data, status=201)