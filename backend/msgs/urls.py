from django.urls import path
from . import views

urlpatterns = [
    path("<int:order_id>/", views.messages_by_order, name="messages-by-order"),
]