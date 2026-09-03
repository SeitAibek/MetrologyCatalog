import time
import base64
import binascii
from django.db.models import Sum
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from users.models import User
from users.permissions import has_role
from laboratories.models import Laboratory
from catalog.models import Service
from .models import Result, Order, OrderItem, Contract
from .serializers import OrderSerializer, OrderItemSerializer, ContractSerializer, ResultSerializer
from . import email_utils, pdf_service
from notifications import services as notification_services


def _get_order_or_404(order_id, message="Заказ не найден"):
    try:
        return Order.objects.get(id=order_id), None
    except Order.DoesNotExist:
        return None, Response({"message": message}, status=404)


def _get_contract_or_404(order_id):
    try:
        return Contract.objects.get(order_id=order_id), None
    except Contract.DoesNotExist:
        return None, Response({"message": "Договор не найден"}, status=404)


def _create_order_items(order, items, item_schema):
    # item_schema — срез схемы услуги с scope="item" на момент записи, а не
    # текущая схема услуги: старые позиции должны отображаться так же, как
    # были заполнены, даже если менеджер потом изменит шаблон.
    for item in items:
        OrderItem.objects.create(
            order=order,
            device_type=item.get("device_type"),
            model=item.get("model"),
            serial_number=item.get("serial_number"),
            quantity=item.get("quantity"),
            custom_fields_schema=item_schema,
            custom_fields_values=item.get("custom_fields_values") or {},
        )


def _validate_order_items(items):
    for item in items:
        if not item.get("device_type"):
            return Response({"message": "Тип прибора обязателен"}, status=400)
        if not item.get("serial_number"):
            return Response({"message": "Серийный номер обязателен"}, status=400)
        if not item.get("quantity") or item.get("quantity") <= 0:
            return Response({"message": "Количество должно быть больше 0"}, status=400)
    return None


def _validate_custom_fields(schema, order_values, items_values):
    # Идём от схемы, а не от values — лишние ключи в values, которых нет в
    # схеме (например, оставшиеся от прежнего шаблона услуги), не валят
    # запрос и сохраняются как есть, без фильтрации.
    # Проверяется только required в этой версии — тип значения (число, дата
    # и т.п.) не валидируется, это отдельный будущий слой.
    def is_empty(value):
        if value is None:
            return True
        if isinstance(value, str):
            return not value.strip()
        return False

    for field in schema:
        if not field.get("required"):
            continue
        label = field.get("label", field.get("key"))
        if field.get("scope") == "order":
            if is_empty((order_values or {}).get(field["key"])):
                return Response({"message": f"Заполните поле «{label}»"}, status=400)
        else:
            for values in items_values:
                if is_empty((values or {}).get(field["key"])):
                    return Response({"message": f"Заполните поле «{label}»"}, status=400)

    return None


def _require_role(request, *allowed_roles):
    if request.user.role not in allowed_roles:
        return Response({"message": "Доступ запрещён"}, status=403)
    return None


def _check_order_read_access(request, order):
    # Кто вообще допущен до вьюхи — решает @permission_classes на ней. Здесь
    # только владение для ролей, у которых заказы личные, а не общие на роль.
    role = request.user.role
    if role == "client" and order.client_id != request.user.id:
        return Response({"message": "Заявка вам не принадлежит"}, status=403)
    if role == "metrolog" and order.metrologist_id != request.user.id:
        return Response({"message": "Заявка не назначена вам"}, status=403)
    # Черновик виден только автору — это правило действует поверх ролевого
    # доступа, включая штабные роли с обычно безусловным доступом: их id
    # никогда не совпадёт с client_id заявки, значит доступ закрыт для всех,
    # кроме реального автора, каким бы ни был запрашивающий request.user.role.
    if order.status == "draft" and order.client_id != request.user.id:
        return Response({"message": "Заявка вам не принадлежит"}, status=403)
    return None


CONTRACT_STAFF_ROLES = ("manager", "approver", "financier", "director", "gen_director")


def _check_contract_party(request, contract):
    # Стороны договора: штабные роли, которые его ведут и подписывают, клиент
    # своей заявки и назначенный на неё метролог. Постороннему — 404, а не 403:
    # 403 подтвердил бы, что договор по такому заказу существует.
    role = request.user.role
    if role in CONTRACT_STAFF_ROLES:
        return None

    order = Order.objects.filter(id=contract.order_id).first()
    if order:
        if role == "client" and order.client_id == request.user.id:
            return None
        if role == "metrolog" and order.metrologist_id == request.user.id:
            return None
    return Response({"message": "Договор не найден"}, status=404)


def _apply_if_present(request, obj, field):
    # Отсутствие ключа в теле запроса значит "не менялось" и не должно затирать
    # уже сохранённое значение — актуально для вложений: фронт не перезаливает
    # файл, если пользователь его не менял, и .get(field) с дефолтом None в
    # этом случае молча обнулил бы уже сохранённое вложение (тот же класс
    # бага, что был в форме доработки заявки).
    if field in request.data:
        setattr(obj, field, request.data.get(field))


def _decode_base64_or_error(data, label="Файл"):
    # Битый base64 (например, оборванная загрузка) иначе валит decode необработанным
    # исключением (500) вместо понятного ответа клиенту.
    try:
        return base64.b64decode(data), None
    except (binascii.Error, ValueError):
        return None, Response({"message": f"{label}: повреждённые данные, ожидался валидный base64"}, status=400)


@api_view(["GET"])
@permission_classes([has_role("manager")])
def get_stats(request):
    total_revenue = Order.objects.filter(status="completed").aggregate(
        total=Sum("price")
    )["total"] or 0

    stats = {
        "totalOrders": Order.objects.count(),
        "completedOrders": Order.objects.filter(status="completed").count(),
        "inWorkOrders": Order.objects.filter(status="in_work").count(),
        "newOrders": Order.objects.filter(status="pending_contract").count(),
        "awaitingPayment": Order.objects.filter(status="awaiting_payment").count(),
        "totalRevenue": total_revenue,
        "totalClients": User.objects.filter(role="client").count(),
    }

    return Response(stats)


@api_view(["POST"])
@permission_classes([has_role("metrolog")])
def create_result(request):
    order_id = request.data.get("order_id")
    result_type = request.data.get("result_type")

    order, err = _get_order_or_404(order_id)
    if err:
        return err
    # Результат создаётся подписанным (is_signed=True), то есть это документ за
    # подписью метролога: и автор, и право его выпустить берутся из токена и
    # назначения, а не из metrologist_id в теле запроса.
    if order.metrologist_id != request.user.id:
        return Response({"message": "Заявка не назначена вам"}, status=403)
    if result_type not in Result.ResultType.values:
        return Response({"message": f"Недопустимый тип результата: {result_type}"}, status=400)

    now = timezone.now()

    Result.objects.create(
        order_id=order.id,
        result_type=result_type,
        metrologist_id=request.user.id,
        issued_at=now,
        is_signed=True,
        signed_at=now,
    )

    return Response({"message": "Результат создан"}, status=201)


@api_view(["GET", "POST"])
def orders_list(request):
    if request.method == "GET":
        err = _require_role(request, "manager", "metrolog")
        if err:
            return err
        if request.user.role == "metrolog":
            # Личное назначение — метролог видит только заявки, назначенные лично ему,
            # а не всю лабораторию (см. assign_to_lab).
            orders = Order.objects.filter(metrologist_id=request.user.id).exclude(status="draft")
        else:
            lab_id = request.query_params.get("labId")
            if lab_id:
                orders = Order.objects.filter(assigned_lab_id=lab_id).exclude(status="draft")
            else:
                # .exclude(status="draft"), а не полагаемся на то, что черновик и так
                # никому не назначен — этот же список отдаётся Reports.tsx без
                # дополнительной фильтрации по стадии.
                orders = Order.objects.exclude(status="draft")
        return Response(OrderSerializer(orders, many=True).data)

    err = _require_role(request, "client", "manager")
    if err:
        return err

    is_draft = bool(request.data.get("is_draft"))

    client_id = request.data.get("client_id")
    service_id = request.data.get("service_id")
    lab_id = request.data.get("lab_id")
    due_date = request.data.get("due_date")
    order_items = request.data.get("order_items")
    client_comment = request.data.get("client_comment")
    power_of_attorney_file = request.data.get("power_of_attorney_file")
    power_of_attorney_file_name = request.data.get("power_of_attorney_file_name")
    tech_documentation_file = request.data.get("tech_documentation_file")
    tech_documentation_file_name = request.data.get("tech_documentation_file_name")

    if not client_id:
        return Response({"message": "ID клиента обязателен"}, status=400)
    if request.user.role == "client" and str(client_id) != str(request.user.id):
        return Response({"message": "Заявка вам не принадлежит"}, status=403)
    if not service_id:
        return Response({"message": "ID услуги обязателен"}, status=400)
    if not lab_id:
        return Response({"message": "ID лаборатории обязателен"}, status=400)
    # Дата сдачи необязательна для черновика — черновик по определению может
    # быть неполным; при реальной отправке (is_draft=False) она обязательна.
    if not is_draft and not due_date:
        return Response({"message": "Дата сдачи обязательна"}, status=400)
    if not order_items:
        return Response({"message": "Добавьте хотя бы один прибор"}, status=400)
    if power_of_attorney_file:
        _, decode_err = _decode_base64_or_error(power_of_attorney_file, "Доверенность")
        if decode_err:
            return decode_err
    if tech_documentation_file:
        _, decode_err = _decode_base64_or_error(tech_documentation_file, "Документация на СИ")
        if decode_err:
            return decode_err

    items_error = _validate_order_items(order_items)
    if items_error:
        return items_error

    schema = getattr(Service.objects.filter(id=service_id).first(), "custom_fields_schema", None) or []
    order_custom_fields_values = request.data.get("custom_fields_values") or {}

    # Черновик по определению может быть неполным — как и с датой сдачи выше,
    # кастомные поля обязательны только при реальной подаче.
    if not is_draft:
        validation_error = _validate_custom_fields(
            schema, order_custom_fields_values,
            [item.get("custom_fields_values") or {} for item in order_items],
        )
        if validation_error:
            return validation_error

    order_schema = [f for f in schema if f.get("scope") == "order"]
    item_schema = [f for f in schema if f.get("scope") == "item"]

    with transaction.atomic():
        order = Order.objects.create(
            order_number=f"ORD-{int(time.time() * 1000)}",
            client_id=client_id,
            service_id=service_id,
            lab_id=lab_id,
            status="draft" if is_draft else "pending_contract",
            due_date=due_date or None,
            client_comment=client_comment,
            power_of_attorney_file=power_of_attorney_file,
            power_of_attorney_file_name=power_of_attorney_file_name,
            tech_documentation_file=tech_documentation_file,
            tech_documentation_file_name=tech_documentation_file_name,
            custom_fields_schema=order_schema,
            custom_fields_values=order_custom_fields_values,
        )

        _create_order_items(order, order_items, item_schema)

        # Договор и уведомление менеджерам — только при реальной подаче.
        # Черновик ещё не подан, согласовывать и показывать менеджеру нечего.
        if not is_draft:
            Contract.objects.create(
                order=order,
                contract_number=f"CNT-{int(time.time() * 1000)}",
            )

    if not is_draft:
        notification_services.notify_managers_new_order(order.order_number)

    return Response(OrderSerializer(order).data, status=201)


@api_view(["PUT"])
@permission_classes([has_role("client")])
def save_draft(request, id):
    order, err = _get_order_or_404(id)
    if err:
        return err
    if order.status != "draft":
        return Response({"message": "Редактировать можно только черновик"}, status=400)
    if order.client_id != request.user.id:
        return Response({"message": "Заявка вам не принадлежит"}, status=403)

    is_draft = bool(request.data.get("is_draft"))

    service_id = request.data.get("service_id")
    lab_id = request.data.get("lab_id")
    due_date = request.data.get("due_date")
    order_items = request.data.get("order_items")
    client_comment = request.data.get("client_comment")

    if not service_id:
        return Response({"message": "ID услуги обязателен"}, status=400)
    if not lab_id:
        return Response({"message": "ID лаборатории обязателен"}, status=400)
    if not is_draft and not due_date:
        return Response({"message": "Дата сдачи обязательна"}, status=400)
    if not order_items:
        return Response({"message": "Добавьте хотя бы один прибор"}, status=400)

    items_error = _validate_order_items(order_items)
    if items_error:
        return items_error

    schema = getattr(Service.objects.filter(id=service_id).first(), "custom_fields_schema", None) or []
    order_custom_fields_values = request.data.get("custom_fields_values") or {}

    if not is_draft:
        validation_error = _validate_custom_fields(
            schema, order_custom_fields_values,
            [item.get("custom_fields_values") or {} for item in order_items],
        )
        if validation_error:
            return validation_error

    # Ключ отсутствует в теле запроса = вложение не менялось (фронт не
    # перезаливает файл, который клиент не трогал) — обновляем только то, что
    # реально пришло, не затирая уже сохранённое.
    for field in (
        "power_of_attorney_file", "power_of_attorney_file_name",
        "tech_documentation_file", "tech_documentation_file_name",
    ):
        _apply_if_present(request, order, field)

    if request.data.get("power_of_attorney_file"):
        _, decode_err = _decode_base64_or_error(order.power_of_attorney_file, "Доверенность")
        if decode_err:
            return decode_err
    if request.data.get("tech_documentation_file"):
        _, decode_err = _decode_base64_or_error(order.tech_documentation_file, "Документация на СИ")
        if decode_err:
            return decode_err

    order.service_id = service_id
    order.lab_id = lab_id
    order.due_date = due_date or None
    order.client_comment = client_comment
    order.custom_fields_values = order_custom_fields_values
    order.custom_fields_schema = [f for f in schema if f.get("scope") == "order"]
    if not is_draft:
        order.status = "pending_contract"

    with transaction.atomic():
        order.save()
        OrderItem.objects.filter(order_id=id).delete()
        item_schema = [f for f in schema if f.get("scope") == "item"]
        _create_order_items(order, order_items, item_schema)

        # Черновик при создании не заводил Contract (см. orders_list POST) —
        # заводим его сейчас, в момент фактической подачи.
        if not is_draft:
            Contract.objects.create(
                order=order,
                contract_number=f"CNT-{int(time.time() * 1000)}",
            )

    if not is_draft:
        notification_services.notify_managers_new_order(order.order_number)

    return Response(OrderSerializer(order).data)


@api_view(["GET"])
@permission_classes([has_role("client")])
def get_my_orders(request):
    client_id = request.query_params.get("clientId")
    if not client_id:
        return Response({"message": "clientId обязателен"}, status=400)
    if str(client_id) != str(request.user.id):
        return Response({"message": "Заявка вам не принадлежит"}, status=403)
    orders = Order.objects.filter(client_id=client_id)
    return Response(OrderSerializer(orders, many=True).data)


@api_view(["GET"])
@permission_classes([has_role("manager", "metrolog")])
def get_orders_by_lab_id(request, lab_id):
    orders = Order.objects.filter(assigned_lab_id=lab_id).exclude(status="draft")
    # Личное назначение метролога действует и здесь: lab_id приходит из URL, и
    # без этого фильтра метролог получил бы по нему все заявки лаборатории,
    # включая назначенные другим — в обход правила, которое соблюдают
    # orders_list GET и _check_order_read_access.
    if request.user.role == "metrolog":
        orders = orders.filter(metrologist_id=request.user.id)
    return Response(OrderSerializer(orders, many=True).data)


@api_view(["GET"])
@permission_classes([has_role("approver", "director", "financier", "gen_director")])
def get_orders_by_status(request, status):
    # status приходит из URL как есть — без явного отказа "draft" эти четыре
    # штабные роли могли бы получить черновики всех клиентов одним GET-запросом.
    if status == "draft":
        return Response({"message": "Доступ запрещён"}, status=403)
    orders = Order.objects.filter(status=status)
    return Response(OrderSerializer(orders, many=True).data)


@api_view(["GET"])
@permission_classes([has_role("client", "manager")])
def get_order_items(request, id):
    order, err = _get_order_or_404(id)
    if err:
        return err
    err = _check_order_read_access(request, order)
    if err:
        return err

    items = OrderItem.objects.filter(order_id=id)
    return Response(OrderItemSerializer(items, many=True).data)


@api_view(["GET", "PUT"])
@permission_classes([has_role(
    "client", "manager", "metrolog", "director", "approver", "financier", "gen_director"
)])
def order_detail(request, id):
    order, err = _get_order_or_404(id)
    if err:
        return err

    if request.method == "GET":
        err = _check_order_read_access(request, order)
        if err:
            return err
        return Response(OrderSerializer(order).data)

    err = _require_role(request, "manager")
    if err:
        return err

    if order.status not in ("pending_contract", "revision"):
        return Response(
            {"message": "Редактировать можно только заявку в статусе 'pending_contract' или 'revision'"},
            status=400,
        )

    service_id = request.data.get("service_id")
    lab_id = request.data.get("lab_id")
    due_date = request.data.get("due_date")
    client_comment = request.data.get("client_comment")

    if service_id is not None:
        order.service_id = service_id
    if lab_id is not None:
        order.lab_id = lab_id
    if due_date:
        order.due_date = due_date
    if client_comment is not None:
        order.client_comment = client_comment

    order.save()

    return Response(OrderSerializer(order).data)


VALID_STATUSES = Order.Status.values


@api_view(["PUT"])
@permission_classes([has_role("client", "metrolog")])
def update_order_status(request, id):
    new_status = request.data.get("status")

    if not new_status or new_status not in VALID_STATUSES:
        return Response({"message": f"Недопустимый статус: {new_status}"}, status=400)

    order, err = _get_order_or_404(id)
    if err:
        return err

    if request.user.role == "metrolog" and order.metrologist_id != request.user.id:
        return Response({"message": "Заявка не назначена вам"}, status=403)
    if request.user.role == "client" and order.client_id != request.user.id:
        return Response({"message": "Заявка вам не принадлежит"}, status=403)

    order.status = new_status
    order.save()

    client = order.client
    if client and client.email:
        if new_status == "completed":
            notification_services.notify_client_completed(client.id, order.id, order.order_number)
        else:
            email_utils.send_status_update(client.email, client.full_name, order.order_number, new_status)
            notification_services.notify_client_status_changed(client.id, order.id, order.order_number, new_status)

    return Response(OrderSerializer(order).data)


@api_view(["PUT"])
@permission_classes([has_role("manager")])
def return_to_revision(request, id):
    order, err = _get_order_or_404(id)
    if err:
        return err

    if order.status != "pending_contract":
        return Response(
            {"message": "Вернуть на доработку можно только заявку в статусе 'pending_contract'"},
            status=400,
        )

    comment = (request.data.get("comment") or "").strip()
    if not comment:
        return Response({"message": "Комментарий обязателен"}, status=400)

    order.status = "revision"
    order.manager_comment = comment
    order.save()

    notification_services.notify_client_revision(order.client_id, order.id, order.order_number)

    return Response(OrderSerializer(order).data)


@api_view(["PUT"])
@permission_classes([has_role("client")])
def resubmit_order(request, id):
    order, err = _get_order_or_404(id)
    if err:
        return err

    if order.client_id != request.user.id:
        return Response({"message": "Заявка вам не принадлежит"}, status=403)
    if order.status != "revision":
        return Response(
            {"message": "Повторно отправить можно только заявку в статусе 'revision'"},
            status=400,
        )

    order_items = request.data.get("order_items")
    if not order_items:
        return Response({"message": "Добавьте хотя бы один прибор"}, status=400)

    items_error = _validate_order_items(order_items)
    if items_error:
        return items_error

    service_id = request.data.get("service_id")
    lab_id = request.data.get("lab_id")
    due_date = request.data.get("due_date")
    client_comment = request.data.get("client_comment")

    # Услуга могла смениться в этом же запросе — схему берём по эффективной
    # (новой, если пришла, иначе текущей) услуге заявки, не по старой.
    effective_service_id = service_id if service_id is not None else order.service_id
    schema = getattr(Service.objects.filter(id=effective_service_id).first(), "custom_fields_schema", None) or []

    # Как и остальные поля ниже — трогаем только если ключ реально пришёл,
    # иначе оставляем то, что уже сохранено на заявке.
    order_custom_fields_values = (
        request.data.get("custom_fields_values") if "custom_fields_values" in request.data
        else order.custom_fields_values
    )
    items_custom_fields_values = [item.get("custom_fields_values") or {} for item in order_items]

    validation_error = _validate_custom_fields(schema, order_custom_fields_values, items_custom_fields_values)
    if validation_error:
        return validation_error

    if service_id is not None:
        order.service_id = service_id
    if lab_id is not None:
        order.lab_id = lab_id
    if due_date:
        order.due_date = due_date
    if client_comment is not None:
        order.client_comment = client_comment
    order.custom_fields_values = order_custom_fields_values or {}
    order.custom_fields_schema = [f for f in schema if f.get("scope") == "order"]
    order.manager_comment = None
    order.status = "pending_contract"

    with transaction.atomic():
        order.save()
        OrderItem.objects.filter(order_id=id).delete()
        item_schema = [f for f in schema if f.get("scope") == "item"]
        _create_order_items(order, order_items, item_schema)

    notification_services.notify_managers_resubmit(order.order_number)

    return Response(OrderSerializer(order).data)


@api_view(["PUT"])
@permission_classes([has_role("manager")])
def send_invoice(request, id):
    order, err = _get_order_or_404(id)
    if err:
        return err

    if order.status != "awaiting_payment":
        return Response(
            {"message": "Счёт можно отправить только для заявки в статусе 'awaiting_payment'"},
            status=400,
        )

    order.invoice_sent = True
    order.save()

    notification_services.notify_client_invoice_sent(order.client_id, order.id, order.order_number)

    return Response(OrderSerializer(order).data)


@api_view(["PUT"])
@permission_classes([has_role("client")])
def upload_receipt(request, id):
    order, err = _get_order_or_404(id)
    if err:
        return err

    if order.client_id != request.user.id:
        return Response({"message": "Заявка вам не принадлежит"}, status=403)
    if order.status != "awaiting_payment":
        return Response(
            {"message": "Чек можно загрузить только для заявки в статусе 'awaiting_payment'"},
            status=400,
        )
    if order.price is None:
        return Response({"message": "Финансист ещё не объявил цену. Дождитесь счёта."}, status=400)
    if not order.invoice_sent:
        return Response({"message": "Менеджер ещё не отправил вам счёт."}, status=400)

    file_data = request.data.get("file_data")
    file_name = request.data.get("file_name")

    if not file_data:
        return Response({"message": "Файл чека обязателен"}, status=400)
    if not file_name:
        return Response({"message": "Имя файла обязательно"}, status=400)
    if len(file_data) > 7_000_000:
        return Response({"message": "Файл слишком большой. Максимум 5MB"}, status=400)
    _, decode_err = _decode_base64_or_error(file_data, "Файл чека")
    if decode_err:
        return decode_err

    order.payment_receipt = file_data
    order.payment_receipt_name = file_name
    order.receipt_uploaded_at = timezone.now()
    order.save()

    notification_services.notify_financiers_receipt_uploaded(order.id, order.order_number)

    return Response({
        "id": order.id,
        "orderNumber": order.order_number,
        "status": order.status,
        "paymentReceiptName": order.payment_receipt_name,
        "receiptUploadedAt": order.receipt_uploaded_at,
        "receiptUploaded": True,
    })


@api_view(["GET"])
@permission_classes([has_role("financier", "manager")])
def get_receipt(request, id):
    order, err = _get_order_or_404(id)
    if err:
        return err

    if not order.payment_receipt:
        return Response({"message": "Чек ещё не загружен"}, status=404)

    return Response({
        "fileData": order.payment_receipt,
        "fileName": order.payment_receipt_name,
        "uploadedAt": order.receipt_uploaded_at,
    })


@api_view(["PUT"])
@permission_classes([has_role("financier")])
def set_price(request, id):
    order, err = _get_order_or_404(id)
    if err:
        return err

    if order.status != "awaiting_payment":
        return Response(
            {"message": "Цену можно объявить только для заявки в статусе 'awaiting_payment'"},
            status=400,
        )

    price = request.data.get("price")
    try:
        price_is_valid = price is not None and 0 < float(price) <= 99_999_999.99
    except (TypeError, ValueError):
        price_is_valid = False
    if not price_is_valid:
        return Response({"message": "Цена должна быть больше 0 и не превышать 99 999 999.99"}, status=400)

    order.price = price
    order.save()

    notification_services.notify_manager_invoice_ready(order.id, order.order_number)

    return Response(OrderSerializer(order).data)


@api_view(["PUT"])
@permission_classes([has_role("financier")])
def confirm_payment(request, id):
    order, err = _get_order_or_404(id)
    if err:
        return err

    if order.status != "awaiting_payment":
        return Response(
            {"message": "Подтвердить оплату можно только для заявки в статусе 'awaiting_payment'"},
            status=400,
        )

    comment = request.data.get("comment")
    if comment is not None:
        order.payment_comment = comment

    price = request.data.get("price")
    if price is not None:
        try:
            price_is_valid = 0 < float(price) <= 99_999_999.99
        except (TypeError, ValueError):
            price_is_valid = False
        if not price_is_valid:
            return Response({"message": "Цена должна быть больше 0 и не превышать 99 999 999.99"}, status=400)
        order.price = price

    order.status = "pending_delivery"
    order.save()

    notification_services.notify_manager_payment_confirmed(order.id, order.order_number)

    return Response(OrderSerializer(order).data)


@api_view(["PUT"])
@permission_classes([has_role("manager")])
def notify_director(request, id):
    order, err = _get_order_or_404(id)
    if err:
        return err

    if order.status != "pending_delivery":
        return Response(
            {"message": "Уведомить руководителя можно только для заявки в статусе 'pending_delivery'"},
            status=400,
        )

    order.status = "awaiting_delivery"
    order.save()

    notification_services.notify_director_to_assign(order.id, order.order_number)

    return Response(OrderSerializer(order).data)


@api_view(["PUT"])
@permission_classes([has_role("director")])
def assign_to_lab(request, id):
    order, err = _get_order_or_404(id)
    if err:
        return err

    if order.status != "awaiting_delivery":
        return Response(
            {"message": "Направить можно только заявку в статусе 'awaiting_delivery'"},
            status=400,
        )

    lab_id = request.data.get("lab_id")
    metrologist_id = request.data.get("metrologist_id")
    if not lab_id:
        return Response({"message": "ID лаборатории обязателен"}, status=400)
    if not metrologist_id:
        return Response({"message": "ID ответственного метролога обязателен"}, status=400)

    try:
        lab = Laboratory.objects.get(id=lab_id)
    except Laboratory.DoesNotExist:
        return Response({"message": "Лаборатория не найдена"}, status=404)

    try:
        metrologist = User.objects.get(id=metrologist_id, role="metrolog", is_active=True)
    except User.DoesNotExist:
        return Response({"message": "Метролог не найден или неактивен"}, status=404)
    if str(metrologist.lab_id) != str(lab_id):
        return Response({"message": "Метролог не принадлежит выбранной лаборатории"}, status=400)

    order.assigned_lab_id = lab_id
    order.assigned_at = timezone.now()
    order.metrologist_id = metrologist_id
    order.status = "received_in_lab"
    order.save()

    lab_name = lab.name + (f" ({lab.city})" if lab.city else "")
    notification_services.notify_assigned_to_lab(order.client_id, order.id, order.order_number, lab_name)

    return Response(OrderSerializer(order).data)


@api_view(["PUT"])
@permission_classes([has_role("metrolog")])
def submit_expertise(request, id):
    order, err = _get_order_or_404(id)
    if err:
        return err

    if order.metrologist_id != request.user.id:
        return Response({"message": "Заявка не назначена вам"}, status=403)
    if order.status != "expertise":
        return Response(
            {"message": "Экспертизу можно завершить только для заявки в статусе 'expertise'"},
            status=400,
        )

    test_program_file = request.data.get("test_program_draft_file")
    test_program_file_name = request.data.get("test_program_draft_file_name")
    type_description_file = request.data.get("type_description_draft_file")
    type_description_file_name = request.data.get("type_description_draft_file_name")
    conclusion = (request.data.get("expertise_conclusion") or "").strip()

    if not test_program_file or not test_program_file_name:
        return Response({"message": "Проект программы испытаний обязателен"}, status=400)
    if not type_description_file or not type_description_file_name:
        return Response({"message": "Проект описания типа обязателен"}, status=400)
    if not conclusion:
        return Response({"message": "Экспертное заключение обязательно"}, status=400)
    if len(test_program_file) > 10_000_000 or len(type_description_file) > 10_000_000:
        return Response({"message": "Файл слишком большой. Максимум 10MB"}, status=400)
    _, decode_err = _decode_base64_or_error(test_program_file, "Проект программы испытаний")
    if decode_err:
        return decode_err
    _, decode_err = _decode_base64_or_error(type_description_file, "Проект описания типа")
    if decode_err:
        return decode_err

    order.test_program_draft_file = test_program_file
    order.test_program_draft_file_name = test_program_file_name
    order.type_description_draft_file = type_description_file
    order.type_description_draft_file_name = type_description_file_name
    order.expertise_conclusion = conclusion
    order.status = "in_work"
    order.save()

    return Response(OrderSerializer(order).data)


@api_view(["GET", "POST"])
def contract_detail(request, order_id):
    if request.method == "GET":
        contract, err = _get_contract_or_404(order_id)
        if err:
            return err
        err = _check_contract_party(request, contract)
        if err:
            return err
        return Response(ContractSerializer(contract).data)

    err = _require_role(request, "manager")
    if err:
        return err

    order, err = _get_order_or_404(order_id, message="Заявка не найдена")
    if err:
        return err

    file_data = request.data.get("file_data")
    file_name = request.data.get("file_name")

    if not file_data:
        return Response({"message": "Файл договора обязателен"}, status=400)
    if not file_name:
        return Response({"message": "Имя файла обязательно"}, status=400)
    if len(file_data) > 10_000_000:
        return Response({"message": "Файл слишком большой. Максимум 7MB"}, status=400)
    _, decode_err = _decode_base64_or_error(file_data, "Файл договора")
    if decode_err:
        return decode_err

    contract, _ = Contract.objects.get_or_create(
        order_id=order_id,
        defaults={"contract_number": f"CNT-{int(time.time() * 1000)}"},
    )

    if contract.status in ("pending_approval", "signed"):
        return Response(ContractSerializer(contract).data)

    contract.contract_file = file_data
    contract.contract_file_name = file_name
    contract.status = "pending_approval"
    contract.reset_approval_state()
    contract.save()

    order.status = "awaiting_approval"
    order.save()

    notification_services.notify_parallel_approvers(order_id, order.order_number)

    return Response(ContractSerializer(contract).data)


@api_view(["GET"])
@permission_classes([has_role("approver", "financier", "director", "gen_director")])
def download_contract_file(request, order_id):
    contract, err = _get_contract_or_404(order_id)
    if err:
        return err
    if not contract.contract_file:
        return Response({"message": "Файл договора ещё не загружен"}, status=404)

    file_bytes, decode_err = _decode_base64_or_error(contract.contract_file, "Файл договора")
    if decode_err:
        return decode_err
    file_name = contract.contract_file_name or f"contract_{order_id}.pdf"
    content_type = "application/pdf" if file_name.endswith(".pdf") else "application/octet-stream"

    response = HttpResponse(file_bytes, content_type=content_type)
    response["Content-Disposition"] = f'attachment; filename="{file_name}"'
    return response


@api_view(["PUT"])
@permission_classes([has_role("manager")])
def resubmit_for_approval(request, order_id):
    contract, err = _get_contract_or_404(order_id)
    if err:
        return err
    if not contract.contract_file:
        return Response({"message": "Сначала загрузите файл договора"}, status=400)

    contract.status = "pending_approval"
    contract.reset_approval_state()
    contract.save()

    order = Order.objects.filter(id=order_id).first()
    if order:
        order.status = "awaiting_approval"
        order.save()
        notification_services.notify_parallel_approvers(order_id, order.order_number)

    return Response(ContractSerializer(contract).data)


def _notify_client_if_trio_signed(contract):
    if not contract.is_trio_signed:
        return
    order = Order.objects.filter(id=contract.order_id).first()
    if order:
        notification_services.notify_client_trio_signed(order.client_id, order.id, order.order_number)


ROLE_SIGN_LABELS = {
    "approver": "Согласующий",
    "financier": "Финансист",
    "director": "Директор",
    "client": "Клиент",
    "gen_director": "Ген.директор",
}


def _require_pending_approval(contract):
    # Единственный статус, из которого достижимо и подписание, и отклонение —
    # см. обоснование в истории Б2: pending_approval держится весь период
    # согласования, отклонённый/подписанный/ещё не поданный договор сюда не входит.
    if contract.status != "pending_approval":
        return "Договор не на согласовании"
    if not contract.contract_file:
        return "Менеджер ещё не загрузил файл договора"
    return None


def _sign_role(request, order_id, role, extra_check=None, before_save=None, after_save=None):
    """
    extra_check(contract) -> str | None — доп. условие допуска к подписи сверх
    общих (нужно client/gen_director: допуск зависит от того, подписали ли уже
    другие, а не только от отсутствия собственной подписи).
    before_save(contract) — мутирует контракт до сохранения, в той же транзакции,
    что и флаг подписи (нужно gen_director: статус и рег.номер выставляются
    одним UPDATE вместе с флагом, а не отдельным сохранением).
    after_save(request, order_id, contract) — что сделать после сохранения; по
    умолчанию — уведомление клиента при завершении тройки (поведение approver/
    financier/director).
    """
    contract, err = _get_contract_or_404(order_id)
    if err:
        return err
    guard_message = _require_pending_approval(contract)
    if guard_message:
        return Response({"message": guard_message}, status=400)
    if extra_check:
        extra_message = extra_check(contract)
        if extra_message:
            return Response({"message": extra_message}, status=400)
    if getattr(contract, f"{role}_signed"):
        return Response({"message": f"{ROLE_SIGN_LABELS[role]} уже подписал"}, status=400)

    setattr(contract, f"{role}_signed", True)
    setattr(contract, f"{role}_signed_at", timezone.now())
    setattr(contract, f"{role}_signed_by_id", request.user.id)
    if before_save:
        before_save(contract)
    contract.save()

    if after_save:
        after_save(request, order_id, contract)
    else:
        _notify_client_if_trio_signed(contract)

    return Response(ContractSerializer(contract).data)


@api_view(["PUT"])
@permission_classes([has_role("approver")])
def sign_by_approver(request, order_id):
    return _sign_role(request, order_id, "approver")


@api_view(["PUT"])
@permission_classes([has_role("financier")])
def sign_by_financier(request, order_id):
    return _sign_role(request, order_id, "financier")


@api_view(["PUT"])
@permission_classes([has_role("director")])
def sign_by_director(request, order_id):
    return _sign_role(request, order_id, "director")


@api_view(["PUT"])
@permission_classes([has_role("approver")])
def approve_contract(request, order_id):
    # Отдельный URL (contracts/<id>/approve/), исторически дублирующий sign/approver/ — оставлен для обратной совместимости фронтенда.
    return _sign_role(request, order_id, "approver")


def _client_sign_precondition(contract):
    if not contract.is_trio_signed:
        return "Договор ещё не подписан всеми сторонами организации"
    return None


def _notify_gen_director_after_client_signs(request, order_id, contract):
    order = Order.objects.filter(id=order_id).first()
    if order:
        notification_services.notify_gen_director_for_signing(order_id, order.order_number)


@api_view(["PUT"])
@permission_classes([has_role("client")])
def sign_by_client(request, order_id):
    # Роль client общая для всех заказчиков, поэтому одной её мало: без проверки
    # владения любой клиент подписывал бы договор по чужой заявке, и в
    # client_signed_by_id оставался бы он же.
    order, err = _get_order_or_404(order_id)
    if err:
        return err
    if order.client_id != request.user.id:
        return Response({"message": "Заявка вам не принадлежит"}, status=403)

    return _sign_role(
        request, order_id, "client",
        extra_check=_client_sign_precondition,
        after_save=_notify_gen_director_after_client_signs,
    )


def _gen_director_sign_precondition(contract):
    if not contract.is_trio_signed:
        return "Тройка ещё не подписала договор"
    if not contract.client_signed:
        return "Клиент ещё не подписал договор"
    return None


def _finalize_signed_contract(contract):
    contract.status = "signed"
    contract.registration_number = f"РЕГ-{timezone.now().strftime('%Y%m%d')}-{contract.order_id}"


def _advance_order_after_gen_director_signs(request, order_id, contract):
    order = Order.objects.filter(id=order_id).first()
    if order:
        order.status = "awaiting_payment"
        order.save()
        notification_services.notify_financiers_contract_signed(order_id, order.order_number)


@api_view(["PUT"])
@permission_classes([has_role("gen_director")])
def sign_by_gen_director(request, order_id):
    return _sign_role(
        request, order_id, "gen_director",
        extra_check=_gen_director_sign_precondition,
        before_save=_finalize_signed_contract,
        after_save=_advance_order_after_gen_director_signs,
    )


@api_view(["PUT"])
@permission_classes([has_role("approver", "director", "financier", "gen_director")])
def reject_contract(request, order_id):
    contract, err = _get_contract_or_404(order_id)
    if err:
        return err
    guard_message = _require_pending_approval(contract)
    if guard_message:
        return Response({"message": guard_message}, status=400)

    reason = request.data.get("reason")

    # Сброс — до присвоения новых значений: reset_approval_state() сам обнуляет
    # rejected_by_role/rejected_reason, иначе он же сотрёт то, что ставим ниже.
    contract.reset_approval_state()
    contract.status = "rejected"
    contract.rejected_by_role = request.user.role
    contract.rejected_reason = reason
    contract.save()

    order = Order.objects.filter(id=order_id).first()
    if order:
        order.status = "pending_contract"
        order.save()
        notification_services.notify_managers_rejected(order_id, order.order_number, reason or "Причина не указана")

    return Response(ContractSerializer(contract).data)


def _close_contract(request, order_id, action):
    """action: 'annulled' или 'terminated' — совпадает и со статусом Contract, и Order."""
    contract, err = _get_contract_or_404(order_id)
    if err:
        return err

    contract.status = action
    setattr(contract, f"{action}_at", timezone.now())
    setattr(contract, f"{action}_by_id", request.user.id)
    setattr(contract, f"{action}_reason", request.data.get("reason"))
    contract.save()

    order = Order.objects.filter(id=order_id).first()
    if order:
        order.status = action
        order.save()

    return Response(ContractSerializer(contract).data)


@api_view(["PUT"])
@permission_classes([has_role("director", "gen_director", "manager")])
def annul_contract(request, order_id):
    return _close_contract(request, order_id, "annulled")


@api_view(["PUT"])
@permission_classes([has_role("director", "gen_director", "manager")])
def terminate_contract(request, order_id):
    return _close_contract(request, order_id, "terminated")


@api_view(["GET"])
@permission_classes([has_role("client", "manager", "metrolog")])
def download_contract(request, order_id):
    try:
        contract = Contract.objects.get(order_id=order_id)
        order = Order.objects.get(id=order_id)
    except (Contract.DoesNotExist, Order.DoesNotExist):
        return Response({"message": "Договор не найден"}, status=404)

    err = _check_order_read_access(request, order)
    if err:
        return err

    if contract.contract_file:
        file_bytes, decode_err = _decode_base64_or_error(contract.contract_file, "Файл договора")
        if decode_err:
            return decode_err
        file_name = contract.contract_file_name or f"contract_{order_id}.pdf"
        response = HttpResponse(file_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{file_name}"'
        return response

    pdf_bytes = pdf_service.generate_contract_pdf(order, contract)
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="contract_{order_id}.pdf"'
    return response


@api_view(["GET"])
@permission_classes([has_role("client", "manager", "metrolog")])
def download_certificate(request, order_id):
    order, err = _get_order_or_404(order_id)
    if err:
        return err
    err = _check_order_read_access(request, order)
    if err:
        return err

    result = Result.objects.filter(order_id=order_id).first()

    pdf_bytes = pdf_service.generate_certificate_pdf(order, result)

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="certificate_{order_id}.pdf"'
    return response


@api_view(["GET"])
@permission_classes([has_role("client", "manager", "financier")])
def download_invoice(request, order_id):
    order, err = _get_order_or_404(order_id, message="Заявка не найдена")
    if err:
        return err
    err = _check_order_read_access(request, order)
    if err:
        return err

    pdf_bytes = pdf_service.generate_invoice_pdf(order)

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="invoice_{order_id}.pdf"'
    return response


@api_view(["GET"])
@permission_classes([has_role("client", "manager", "metrolog")])
def get_results_by_order(request, order_id):
    order, err = _get_order_or_404(order_id)
    if err:
        return err
    err = _check_order_read_access(request, order)
    if err:
        return err

    results = Result.objects.filter(order_id=order_id)
    return Response(ResultSerializer(results, many=True).data)
