from django.urls import path
from . import views

urlpatterns = [
    path("", views.get_all_labs, name="labs-list"),
]