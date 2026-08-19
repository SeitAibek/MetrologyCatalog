from django.urls import path
from . import views

urlpatterns = [
    path("", views.devices_list, name="devices-list-create"),
    path("<int:id>/", views.device_detail, name="device-detail"),
]