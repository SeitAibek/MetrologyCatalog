import bcrypt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

import uuid
from datetime import timedelta
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction

from .models import User
from companies.models import Company
from . import jwt_utils
from .serializers import UserSerializer
from companies.serializers import CompanySerializer
from .permissions import has_role



def _user_payload(user: User) -> dict:
    return {
        "id": user.id,
        "id_number": user.id_number,
        "email": user.email,
        "fullName": user.full_name,
        "phone": user.phone,
        "role": user.role,
        "companyId": user.company_id,
        "labId": user.lab_id,
    }


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    id_number = request.data.get("id_number")
    password = request.data.get("password")

    if not id_number or not password:
        return Response({"message": "ИИН и пароль обязательны"}, status=400)

    try:
        user = User.objects.get(id_number=id_number)
    except User.DoesNotExist:
        return Response({"message": "Пользователь не найден"}, status=401)

    if not user.is_active:
        return Response({"message": "Пользователь неактивен"}, status=401)

    if not bcrypt.checkpw(password.encode(), user.password_hash.encode()):
        return Response({"message": "Неверный пароль"}, status=401)

    token = jwt_utils.generate_token(user.id, user.email, user.role, user.lab_id)

    return Response({"token": token, "user": _user_payload(user)})


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    id_number = request.data.get("id_number")
    password = request.data.get("password")
    full_name = request.data.get("full_name")
    phone = request.data.get("phone")
    bin_number = request.data.get("bin")
    company_name = request.data.get("company_name")
    company_address = request.data.get("company_address")
    email = request.data.get("email")

    if not id_number:
        return Response({"message": "ИИН обязателен"}, status=400)
    if len(id_number) != 12 or not id_number.isdigit():
        return Response({"message": "ИИН должен содержать ровно 12 цифр"}, status=400)
    if not password or len(password) < 6:
        return Response({"message": "Пароль должен быть не менее 6 символов"}, status=400)
    if not full_name:
        return Response({"message": "ФИО обязательно"}, status=400)
    if not phone:
        return Response({"message": "Телефон обязателен"}, status=400)
    if not bin_number:
        return Response({"message": "БИН компании обязателен"}, status=400)
    if len(bin_number) != 12 or not bin_number.isdigit():
        return Response({"message": "БИН должен содержать ровно 12 цифр"}, status=400)
    if not company_name:
        return Response({"message": "Название компании обязательно"}, status=400)
    if not company_address:
        return Response({"message": "Адрес компании обязателен"}, status=400)

    if User.objects.filter(id_number=id_number).exists():
        return Response({"message": "Пользователь с таким ИИН уже зарегистрирован"}, status=409)

    if email:
        if User.objects.filter(email=email).exists():
            return Response({"message": "Email уже зарегистрирован"}, status=409)

    with transaction.atomic():
        company, _ = Company.objects.get_or_create(
            bin=bin_number,
            defaults={
                "name": company_name,
                "address": company_address,
                "phone": phone,
                "email": email or None,
            },
        )

        password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

        user = User.objects.create(
            id_number=id_number,
            email=email or None,
            password_hash=password_hash,
            role="client",
            full_name=full_name,
            phone=phone,
            company_id=company.id,
            is_active=True,
        )

    token = jwt_utils.generate_token(user.id, user.email, user.role, user.lab_id)

    return Response({"token": token, "user": _user_payload(user)}, status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
def forgot_password(request):
    email = request.data.get("email")

    if not email:
        return Response({"message": "Email обязателен"}, status=400)

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({"message": "Ссылка отправлена на email если он зарегистрирован"})

    token = str(uuid.uuid4())
    user.password_reset_token = token
    user.password_reset_expires = timezone.now() + timedelta(hours=24)
    user.save()

    reset_link = f"http://localhost:5173/reset-password?token={token}"
    send_mail(
        subject="Восстановление пароля",
        message=f"Здравствуйте, {user.full_name}!\n\nСсылка для сброса пароля: {reset_link}\n\nСсылка действительна 24 часа.",
        from_email=None,
        recipient_list=[email],
    )

    return Response({"message": "Ссылка отправлена на email если он зарегистрирован"})


@api_view(["POST"])
@permission_classes([AllowAny])
def reset_password(request):
    token = request.data.get("token")
    password = request.data.get("new_password")

    if not token or not password:
        return Response({"message": "Токен и пароль обязательны"}, status=400)

    try:
        user = User.objects.get(password_reset_token=token)
    except User.DoesNotExist:
        return Response({"message": "Недействительный токен"}, status=400)

    if user.password_reset_expires is None or user.password_reset_expires < timezone.now():
        return Response({"message": "Срок действия ссылки истёк"}, status=400)

    user.password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    user.password_reset_token = None
    user.password_reset_expires = None
    user.save()

    return Response({"message": "Пароль успешно изменён"})


@api_view(["GET", "PUT"])
def profile(request):
    if request.method == "GET":
        user_id = request.query_params.get("userId")
        if not user_id:
            return Response({"message": "userId обязателен"}, status=400)

        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({"message": "Пользователь не найден"}, status=404)

        company_data = None
        if user.company_id:
            company = Company.objects.filter(id=user.company_id).first()
            if company:
                company_data = CompanySerializer(company).data

        return Response({
            "user": UserSerializer(user).data,
            "company": company_data,
        })

    user_id = request.data.get("id")
    if not user_id:
        return Response({"message": "ID пользователя не указан"}, status=400)

    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"message": "Пользователь не найден"}, status=404)

    full_name = request.data.get("full_name")
    phone = request.data.get("phone")
    email = request.data.get("email")

    if full_name is not None:
        user.full_name = full_name
    if phone is not None:
        user.phone = phone
    if email is not None:
        user.email = email
    user.save()

    company_payload = request.data.get("company")
    if user.company_id and company_payload:
        company = Company.objects.filter(id=user.company_id).first()
        if company:
            name = company_payload.get("name")
            address = company_payload.get("address")
            phone = company_payload.get("phone")
            email = company_payload.get("email")

            if name and name.strip():
                company.name = name
            if address and address.strip():
                company.address = address
            if phone is not None:
                company.phone = phone
            if email is not None:
                company.email = email
            company.save()

    company_data = None
    if user.company_id:
        company = Company.objects.filter(id=user.company_id).first()
        if company:
            company_data = CompanySerializer(company).data

    return Response({
        "user": UserSerializer(user).data,
        "company": company_data,
    })


@api_view(["GET"])
@permission_classes([has_role("admin")])
def get_all_users(request):
    users = User.objects.all()
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([has_role("manager")])
def get_clients(request):
    clients = User.objects.filter(role="client")
    return Response(UserSerializer(clients, many=True).data)


VALID_ROLES = [choice[0] for choice in User.ROLE_CHOICES]


@api_view(["PUT"])
@permission_classes([has_role("admin")])
def update_role(request, id):
    role = request.data.get("role")
    if role not in VALID_ROLES:
        return Response({"message": f"Недопустимая роль: {role}"}, status=400)

    try:
        user = User.objects.get(id=id)
    except User.DoesNotExist:
        return Response({"message": "Пользователь не найден"}, status=404)

    user.role = role
    user.save()

    return Response(UserSerializer(user).data)


@api_view(["PUT"])
@permission_classes([has_role("admin")])
def update_active(request, id):
    active = request.data.get("active")
    if not isinstance(active, bool):
        return Response({"message": "Поле 'active' должно быть true или false"}, status=400)

    try:
        user = User.objects.get(id=id)
    except User.DoesNotExist:
        return Response({"message": "Пользователь не найден"}, status=404)

    user.is_active = active
    user.save()

    return Response(UserSerializer(user).data)