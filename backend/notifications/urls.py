from django.urls import path
from . import views

urlpatterns = [
    path("", views.get_my_notifications, name="my-notifications"),
    path("unread/", views.get_unread_notifications, name="unread-notifications"),
    path("read-all/", views.mark_all_as_read, name="mark-all-read"),
    path("<int:id>/read/", views.mark_as_read, name="notification-mark-read"),
]