"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include

from users import views as user_views
from orders import views as orders_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path("api/auth/", include("users.urls")),
    path("api/profile/", user_views.profile, name="profile"),
    path("api/users/", include([
        path("", user_views.get_all_users, name="users-list"),
        path("<int:id>/role/", user_views.update_role, name="user-update-role"),
        path("<int:id>/active/", user_views.update_active, name="user-update-active"),
        path("clients/", user_views.get_clients, name="users-clients"),
    ])),
    path("api/services/", include("catalog.urls")),
    path("api/laboratories/", include("laboratories.urls")),
    path("api/devices/", include("devices.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/messages/", include("msgs.urls")),
    path("api/", include("orders.urls")),
]
