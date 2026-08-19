from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


@api_view(["GET"])
def get_my_notifications(request):
    user_id = request.query_params.get("userId")
    if not user_id:
        return Response({"message": "userId обязателен"}, status=400)

    notifications = Notification.objects.filter(user_id=user_id).order_by("-id")
    return Response(NotificationSerializer(notifications, many=True).data)


@api_view(["GET"])
def get_unread_notifications(request):
    user_id = request.query_params.get("userId")
    if not user_id:
        return Response({"message": "userId обязателен"}, status=400)

    notifications = Notification.objects.filter(user_id=user_id, is_read=False).order_by("-id")
    return Response(NotificationSerializer(notifications, many=True).data)


@api_view(["PUT"])
def mark_as_read(request, id):
    try:
        notification = Notification.objects.get(id=id)
    except Notification.DoesNotExist:
        return Response({"message": "Уведомление не найдено"}, status=404)

    notification.is_read = True
    notification.read_at = timezone.now()
    notification.save()

    return Response(NotificationSerializer(notification).data)


@api_view(["PUT"])
def mark_all_as_read(request):
    user_id = request.query_params.get("userId")
    if not user_id:
        return Response({"message": "userId обязателен"}, status=400)

    unread = Notification.objects.filter(user_id=user_id, is_read=False)
    count = unread.count()
    unread.update(is_read=True, read_at=timezone.now())

    return Response({"updated": count})