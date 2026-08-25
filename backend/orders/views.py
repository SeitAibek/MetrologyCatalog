import time
import base64
from django.db.models import Sum
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from users.models import User
from users.permissions import has_role
from laboratories.models import Laboratory
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


def _create_order_items(order, items):
    for item in items:
        OrderItem.objects.create(
            order=order,
            device_type=item.get("device_type"),
            model=item.get("model"),
            serial_number=item.get("serial_number"),
            quantity=item.get("quantity"),
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


def _require_role(request, *allowed_roles):
    if request.user.role not in allowed_roles:
        return Response({"message": "Доступ запрещён"}, status=403)
    return None


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
    metrologist_id = request.data.get("metrologist_id")

    if not Order.objects.filter(id=order_id).exists():
        return Response({"message": "Заказ не найден"}, status=404)
    if not metrologist_id or not User.objects.filter(id=metrologist_id).exists():
        return Response({"message": "Метролог не найден"}, status=404)
    if result_type not in Result.ResultType.values:
        return Response({"message": f"Недопустимый тип результата: {result_type}"}, status=400)

    now = timezone.now()

    Result.objects.create(
        order_id=order_id,
        result_type=result_type,
        metrologist_id=metrologist_id,
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
        lab_id = request.query_params.get("labId")
        if lab_id:
            orders = Order.objects.filter(assigned_lab_id=lab_id)
        else:
            orders = Order.objects.all()
        return Response(OrderSerializer(orders, many=True).data)

    err = _require_role(request, "client", "manager")
    if err:
        return err

    client_id = request.data.get("client_id")
    service_id = request.data.get("service_id")
    lab_id = request.data.get("lab_id")
    due_date = request.data.get("due_date")
    order_items = request.data.get("order_items")
    client_comment = request.data.get("client_comment")

    if not client_id:
        return Response({"message": "ID клиента обязателен"}, status=400)
    if not service_id:
        return Response({"message": "ID услуги обязателен"}, status=400)
    if not lab_id:
        return Response({"message": "ID лаборатории обязателен"}, status=400)
    if not due_date:
        return Response({"message": "Дата сдачи обязательна"}, status=400)
    if not order_items:
        return Response({"message": "Добавьте хотя бы один прибор"}, status=400)

    items_error = _validate_order_items(order_items)
    if items_error:
        return items_error

    with transaction.atomic():
        order = Order.objects.create(
            order_number=f"ORD-{int(time.time() * 1000)}",
            client_id=client_id,
            service_id=service_id,
            lab_id=lab_id,
            status="pending_contract",
            due_date=due_date,
            client_comment=client_comment,
        )

        _create_order_items(order, order_items)

        Contract.objects.create(
            order=order,
            contract_number=f"CNT-{int(time.time() * 1000)}",
        )

    notification_services.notify_managers_new_order(order.order_number)

    return Response(OrderSerializer(order).data, status=201)


@api_view(["GET"])
@permission_classes([has_role("client")])
def get_my_orders(request):
    client_id = request.query_params.get("clientId")
    if not client_id:
        return Response({"message": "clientId обязателен"}, status=400)
    orders = Order.objects.filter(client_id=client_id)
    return Response(OrderSerializer(orders, many=True).data)


@api_view(["GET"])
@permission_classes([has_role("manager", "metrolog")])
def get_orders_by_lab_id(request, lab_id):
    orders = Order.objects.filter(assigned_lab_id=lab_id)
    return Response(OrderSerializer(orders, many=True).data)


@api_view(["GET"])
@permission_classes([has_role("approver", "director", "financier", "gen_director")])
def get_orders_by_status(request, status):
    orders = Order.objects.filter(status=status)
    return Response(OrderSerializer(orders, many=True).data)


@api_view(["GET"])
@permission_classes([has_role("client", "manager")])
def get_order_items(request, id):
    items = OrderItem.objects.filter(order_id=id)
    return Response(OrderItemSerializer(items, many=True).data)


@api_view(["GET", "PUT"])
def order_detail(request, id):
    order, err = _get_order_or_404(id)
    if err:
        return err

    if request.method == "GET":
        return Response(OrderSerializer(order).data)

    err = _require_role(request, "manager")
    if err:
        return err

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

    if service_id is not None:
        order.service_id = service_id
    if lab_id is not None:
        order.lab_id = lab_id
    if due_date:
        order.due_date = due_date
    if client_comment is not None:
        order.client_comment = client_comment
    order.manager_comment = None
    order.status = "pending_contract"

    with transaction.atomic():
        order.save()
        OrderItem.objects.filter(order_id=id).delete()
        _create_order_items(order, order_items)

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

    order.status = "pending_delivery"

    comment = request.data.get("comment")
    if comment is not None:
        order.payment_comment = comment

    price = request.data.get("price")
    if price is not None:
        order.price = price

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
@permission_classes([has_role("director", "gen_director")])
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
    if not lab_id:
        return Response({"message": "ID лаборатории обязателен"}, status=400)

    try:
        lab = Laboratory.objects.get(id=lab_id)
    except Laboratory.DoesNotExist:
        return Response({"message": "Лаборатория не найдена"}, status=404)

    order.assigned_lab_id = lab_id
    order.assigned_at = timezone.now()
    order.status = "received_in_lab"
    order.save()

    lab_name = lab.name + (f" ({lab.city})" if lab.city else "")
    notification_services.notify_assigned_to_lab(order.client_id, order.id, order.order_number, lab_name)

    return Response(OrderSerializer(order).data)


@api_view(["GET", "POST"])
def contract_detail(request, order_id):
    if request.method == "GET":
        contract, err = _get_contract_or_404(order_id)
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

    file_bytes = base64.b64decode(contract.contract_file)
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
}


def _sign_role(request, order_id, role):
    contract, err = _get_contract_or_404(order_id)
    if err:
        return err
    if contract.status != "pending_approval":
        return Response({"message": "Договор не на согласовании"}, status=400)
    if not contract.contract_file:
        return Response({"message": "Менеджер ещё не загрузил файл договора"}, status=400)
    if getattr(contract, f"{role}_signed"):
        return Response({"message": f"{ROLE_SIGN_LABELS[role]} уже подписал"}, status=400)

    setattr(contract, f"{role}_signed", True)
    setattr(contract, f"{role}_signed_at", timezone.now())
    setattr(contract, f"{role}_signed_by_id", request.user.id)
    contract.save()

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


@api_view(["PUT"])
@permission_classes([has_role("client")])
def sign_by_client(request, order_id):
    contract, err = _get_contract_or_404(order_id)
    if err:
        return err
    if not contract.is_trio_signed:
        return Response({"message": "Договор ещё не подписан всеми сторонами организации"}, status=400)
    if contract.client_signed:
        return Response({"message": "Клиент уже подписал"}, status=400)

    contract.client_signed = True
    contract.client_signed_at = timezone.now()
    contract.client_signed_by_id = request.user.id
    contract.save()

    order = Order.objects.filter(id=order_id).first()
    if order:
        notification_services.notify_gen_director_for_signing(order_id, order.order_number)

    return Response(ContractSerializer(contract).data)


@api_view(["PUT"])
@permission_classes([has_role("gen_director")])
def sign_by_gen_director(request, order_id):
    contract, err = _get_contract_or_404(order_id)
    if err:
        return err
    if not contract.is_trio_signed:
        return Response({"message": "Тройка ещё не подписала договор"}, status=400)
    if not contract.client_signed:
        return Response({"message": "Клиент ещё не подписал договор"}, status=400)
    if contract.gen_director_signed:
        return Response({"message": "Ген.директор уже подписал"}, status=400)

    contract.gen_director_signed = True
    contract.gen_director_signed_at = timezone.now()
    contract.gen_director_signed_by_id = request.user.id
    contract.status = "signed"
    contract.registration_number = f"РЕГ-{timezone.now().strftime('%Y%m%d')}-{order_id}"
    contract.save()

    order = Order.objects.filter(id=order_id).first()
    if order:
        order.status = "awaiting_payment"
        order.save()
        notification_services.notify_financiers_contract_signed(order_id, order.order_number)

    return Response(ContractSerializer(contract).data)


@api_view(["PUT"])
@permission_classes([has_role("approver", "director", "financier", "gen_director")])
def reject_contract(request, order_id):
    contract, err = _get_contract_or_404(order_id)
    if err:
        return err

    reason = request.data.get("reason")

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

    if contract.contract_file:
        file_bytes = base64.b64decode(contract.contract_file)
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

    pdf_bytes = pdf_service.generate_invoice_pdf(order)

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="invoice_{order_id}.pdf"'
    return response


@api_view(["GET"])
@permission_classes([has_role("client", "manager", "metrolog")])
def get_results_by_order(request, order_id):
    results = Result.objects.filter(order_id=order_id)
    return Response(ResultSerializer(results, many=True).data)
