from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


# Пользователь везде берётся из request.user, а не из query-параметра: иначе
# любой авторизованный читает и помечает прочитанными чужие уведомления,
# подставив другой id.
@api_view(["GET"])
def get_my_notifications(request):
    notifications = Notification.objects.filter(user_id=request.user.id).order_by("-id")
    return Response(NotificationSerializer(notifications, many=True).data)


@api_view(["GET"])
def get_unread_notifications(request):
    notifications = Notification.objects.filter(
        user_id=request.user.id, is_read=False
    ).order_by("-id")
    return Response(NotificationSerializer(notifications, many=True).data)


@api_view(["PUT"])
def mark_as_read(request, id):
    # Чужое уведомление — 404, а не 403: существование чужих id не подтверждаем.
    try:
        notification = Notification.objects.get(id=id, user_id=request.user.id)
    except Notification.DoesNotExist:
        return Response({"message": "Уведомление не найдено"}, status=404)

    notification.is_read = True
    notification.read_at = timezone.now()
    notification.save()

    return Response(NotificationSerializer(notification).data)


@api_view(["PUT"])
def mark_all_as_read(request):
    unread = Notification.objects.filter(user_id=request.user.id, is_read=False)
    count = unread.count()
    unread.update(is_read=True, read_at=timezone.now())

    return Response({"updated": count})
