from django.urls import path
from . import views

urlpatterns = [
    path("", views.get_all_services, name="services-list"),
    path("<int:id>/", views.get_service_by_id, name="service-detail"),
    path("type/<str:measurement_type>/", views.get_by_measurement_type, name="services-by-type"),
    path("lab/<int:lab_id>/", views.get_by_lab_id, name="services-by-lab"),
]