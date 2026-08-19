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
from .models import Result, Order, OrderItem, Contract
from .serializers import OrderSerializer, OrderItemSerializer, ContractSerializer, ResultSerializer
from . import email_utils, pdf_service
from notifications import services as notification_services


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
        lab_id = request.query_params.get("labId")
        if lab_id:
            orders = Order.objects.filter(lab_id=lab_id)
        else:
            orders = Order.objects.all()
        return Response(OrderSerializer(orders, many=True).data)

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

    for item in order_items:
        if not item.get("device_type"):
            return Response({"message": "Тип прибора обязателен"}, status=400)
        if not item.get("serial_number"):
            return Response({"message": "Серийный номер обязателен"}, status=400)
        if not item.get("quantity") or item.get("quantity") <= 0:
            return Response({"message": "Количество должно быть больше 0"}, status=400)

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

        for item in order_items:
            OrderItem.objects.create(
                order=order,
                device_type=item.get("device_type"),
                model=item.get("model"),
                serial_number=item.get("serial_number"),
                quantity=item.get("quantity"),
            )

        Contract.objects.create(
            order=order,
            contract_number=f"CNT-{int(time.time() * 1000)}",
        )

    notification_services.notify_managers_new_order(order.order_number)

    return Response(OrderSerializer(order).data, status=201)


@api_view(["GET"])
def get_my_orders(request):
    client_id = request.query_params.get("clientId")
    if not client_id:
        return Response({"message": "clientId обязателен"}, status=400)
    orders = Order.objects.filter(client_id=client_id)
    return Response(OrderSerializer(orders, many=True).data)


@api_view(["GET"])
def get_orders_by_lab_id(request, lab_id):
    orders = Order.objects.filter(lab_id=lab_id)
    return Response(OrderSerializer(orders, many=True).data)


@api_view(["GET"])
def get_orders_by_status(request, status):
    orders = Order.objects.filter(status=status)
    return Response(OrderSerializer(orders, many=True).data)


@api_view(["GET"])
def get_order_items(request, id):
    items = OrderItem.objects.filter(order_id=id)
    return Response(OrderItemSerializer(items, many=True).data)


@api_view(["GET", "PUT"])
def order_detail(request, id):
    try:
        order = Order.objects.get(id=id)
    except Order.DoesNotExist:
        return Response({"message": "Заказ не найден"}, status=404)

    if request.method == "GET":
        return Response(OrderSerializer(order).data)

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


VALID_STATUSES = [
    "pending_contract", "revision", "awaiting_approval", "awaiting_director",
    "awaiting_payment", "pending_delivery", "awaiting_delivery", "received_in_lab",
    "in_work", "under_review", "completed", "cancelled", "annulled", "terminated",
]


@api_view(["PUT"])
def update_order_status(request, id):
    new_status = request.data.get("status")

    if not new_status or new_status not in VALID_STATUSES:
        return Response({"message": f"Недопустимый статус: {new_status}"}, status=400)

    try:
        order = Order.objects.get(id=id)
    except Order.DoesNotExist:
        return Response({"message": "Заказ не найден"}, status=404)

    order.status = new_status
    order.save()

    client = order.client
    if client and client.email:
        if new_status == "completed":
            email_utils.send_order_completed(client.email, client.full_name, order.order_number)
            notification_services.notify_client_completed(client.id, order.id, order.order_number)
        else:
            email_utils.send_status_update(client.email, client.full_name, order.order_number, new_status)
            notification_services.notify_client_status_changed(client.id, order.id, order.order_number, new_status)

    return Response(OrderSerializer(order).data)


@api_view(["PUT"])
@permission_classes([has_role("manager")])
def return_to_revision(request, id):
    try:
        order = Order.objects.get(id=id)
    except Order.DoesNotExist:
        return Response({"message": "Заказ не найден"}, status=404)

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
    try:
        order = Order.objects.get(id=id)
    except Order.DoesNotExist:
        return Response({"message": "Заказ не найден"}, status=404)

    if order.status != "revision":
        return Response(
            {"message": "Повторно отправить можно только заявку в статусе 'revision'"},
            status=400,
        )

    order_items = request.data.get("order_items")
    if not order_items:
        return Response({"message": "Добавьте хотя бы один прибор"}, status=400)

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
    order.save()

    with transaction.atomic():
        OrderItem.objects.filter(order_id=id).delete()
        for item in order_items:
            OrderItem.objects.create(
                order=order,
                device_type=item.get("device_type"),
                model=item.get("model"),
                serial_number=item.get("serial_number"),
                quantity=item.get("quantity"),
            )

    notification_services.notify_managers_resubmit(order.order_number)

    return Response(OrderSerializer(order).data)


@api_view(["PUT"])
@permission_classes([has_role("manager")])
def send_invoice(request, id):
    try:
        order = Order.objects.get(id=id)
    except Order.DoesNotExist:
        return Response({"message": "Заказ не найден"}, status=404)

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
    try:
        order = Order.objects.get(id=id)
    except Order.DoesNotExist:
        return Response({"message": "Заказ не найден"}, status=404)

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
    try:
        order = Order.objects.get(id=id)
    except Order.DoesNotExist:
        return Response({"message": "Заказ не найден"}, status=404)

    if not order.payment_receipt:
        return Response({"message": "Чек ещё не загружен"}, status=404)

    return Response({
        "fileData": order.payment_receipt,
        "fileName": order.payment_receipt_name,
        "uploadedAt": order.receipt_uploaded_at,
    })


@api_view(["PUT"])
def set_price(request, id):
    try:
        order = Order.objects.get(id=id)
    except Order.DoesNotExist:
        return Response({"message": "Заказ не найден"}, status=404)

    if order.status != "awaiting_payment":
        return Response(
            {"message": "Цену можно объявить только для заявки в статусе 'awaiting_payment'"},
            status=400,
        )

    price = request.data.get("price")
    if not price or float(price) <= 0:
        return Response({"message": "Цена должна быть больше 0"}, status=400)

    order.price = price
    order.save()

    notification_services.notify_manager_invoice_ready(order.id, order.order_number)

    return Response(OrderSerializer(order).data)


@api_view(["PUT"])
def confirm_payment(request, id):
    try:
        order = Order.objects.get(id=id)
    except Order.DoesNotExist:
        return Response({"message": "Заказ не найден"}, status=404)

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
    try:
        order = Order.objects.get(id=id)
    except Order.DoesNotExist:
        return Response({"message": "Заказ не найден"}, status=404)

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
    try:
        order = Order.objects.get(id=id)
    except Order.DoesNotExist:
        return Response({"message": "Заказ не найден"}, status=404)

    if order.status != "awaiting_delivery":
        return Response(
            {"message": "Направить можно только заявку в статусе 'awaiting_delivery'"},
            status=400,
        )

    lab_id = request.data.get("lab_id")
    if not lab_id:
        return Response({"message": "ID лаборатории обязателен"}, status=400)

    from laboratories.models import Laboratory
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
        try:
            contract = Contract.objects.get(order_id=order_id)
        except Contract.DoesNotExist:
            return Response({"message": "Договор не найден"}, status=404)
        return Response(ContractSerializer(contract).data)

    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return Response({"message": "Заявка не найдена"}, status=404)

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
    contract.approver_signed = False
    contract.approver_signed_at = None
    contract.approver_signed_by = None
    contract.financier_signed = False
    contract.financier_signed_at = None
    contract.financier_signed_by = None
    contract.director_signed = False
    contract.director_signed_at = None
    contract.director_signed_by = None
    contract.client_signed = False
    contract.client_signed_at = None
    contract.client_signed_by = None
    contract.gen_director_signed = False
    contract.gen_director_signed_at = None
    contract.gen_director_signed_by = None
    contract.rejected_by_role = None
    contract.rejected_reason = None
    contract.save()

    order.status = "awaiting_approval"
    order.save()

    notification_services.notify_parallel_approvers(order_id, order.order_number)

    return Response(ContractSerializer(contract).data)
 
 
@api_view(["GET"])
def download_contract_file(request, order_id):
    try:
        contract = Contract.objects.get(order_id=order_id)
    except Contract.DoesNotExist:
        return Response({"message": "Договор не найден"}, status=404)
    if not contract.contract_file:
        return Response({"message": "Файл договора ещё не загружен"}, status=404)
 
    file_bytes = base64.b64decode(contract.contract_file)
    file_name = contract.contract_file_name or f"contract_{order_id}.pdf"
    content_type = "application/pdf" if file_name.endswith(".pdf") else "application/octet-stream"
 
    response = HttpResponse(file_bytes, content_type=content_type)
    response["Content-Disposition"] = f'attachment; filename="{file_name}"'
    return response
 
 
@api_view(["PUT"])
def resubmit_for_approval(request, order_id):
    try:
        contract = Contract.objects.get(order_id=order_id)
    except Contract.DoesNotExist:
        return Response({"message": "Договор не найден"}, status=404)
    if not contract.contract_file:
        return Response({"message": "Сначала загрузите файл договора"}, status=400)
 
    contract.status = "pending_approval"
    contract.approver_signed = False
    contract.approver_signed_at = None
    contract.approver_signed_by = None
    contract.financier_signed = False
    contract.financier_signed_at = None
    contract.financier_signed_by = None
    contract.director_signed = False
    contract.director_signed_at = None
    contract.director_signed_by = None
    contract.client_signed = False
    contract.client_signed_at = None
    contract.client_signed_by = None
    contract.gen_director_signed = False
    contract.gen_director_signed_at = None
    contract.gen_director_signed_by = None
    contract.rejected_by_role = None
    contract.rejected_reason = None
    contract.save()
 
    order = Order.objects.filter(id=order_id).first()
    if order:
        order.status = "awaiting_approval"
        order.save()
        notification_services.notify_parallel_approvers(order_id, order.order_number)
 
    return Response(ContractSerializer(contract).data)
 
 
def _check_trio_and_notify_client(order_id):
    contract = Contract.objects.get(order_id=order_id)
    if contract.is_trio_signed:
        order = Order.objects.filter(id=order_id).first()
        if order:
            notification_services.notify_client_trio_signed(order.client_id, order_id, order.order_number)
 
 
@api_view(["PUT"])
def sign_by_approver(request, order_id):
    try:
        contract = Contract.objects.get(order_id=order_id)
    except Contract.DoesNotExist:
        return Response({"message": "Договор не найден"}, status=404)
    if contract.status != "pending_approval":
        return Response({"message": "Договор не на согласовании"}, status=400)
    if not contract.contract_file:
        return Response({"message": "Менеджер ещё не загрузил файл договора"}, status=400)
    if contract.approver_signed:
        return Response({"message": "Согласующий уже подписал"}, status=400)
 
    contract.approver_signed = True
    contract.approver_signed_at = timezone.now()
    contract.approver_signed_by_id = request.data.get("user_id")
    contract.save()
 
    _check_trio_and_notify_client(order_id)
 
    return Response(ContractSerializer(Contract.objects.get(order_id=order_id)).data)
 
 
@api_view(["PUT"])
def sign_by_financier(request, order_id):
    try:
        contract = Contract.objects.get(order_id=order_id)
    except Contract.DoesNotExist:
        return Response({"message": "Договор не найден"}, status=404)
    if contract.status != "pending_approval":
        return Response({"message": "Договор не на согласовании"}, status=400)
    if not contract.contract_file:
        return Response({"message": "Менеджер ещё не загрузил файл договора"}, status=400)
    if contract.financier_signed:
        return Response({"message": "Финансист уже подписал"}, status=400)
 
    contract.financier_signed = True
    contract.financier_signed_at = timezone.now()
    contract.financier_signed_by_id = request.data.get("user_id")
    contract.save()
 
    _check_trio_and_notify_client(order_id)
 
    return Response(ContractSerializer(Contract.objects.get(order_id=order_id)).data)
 
 
@api_view(["PUT"])
def sign_by_director(request, order_id):
    try:
        contract = Contract.objects.get(order_id=order_id)
    except Contract.DoesNotExist:
        return Response({"message": "Договор не найден"}, status=404)
    if contract.status != "pending_approval":
        return Response({"message": "Договор не на согласовании"}, status=400)
    if not contract.contract_file:
        return Response({"message": "Менеджер ещё не загрузил файл договора"}, status=400)
    if contract.director_signed:
        return Response({"message": "Директор уже подписал"}, status=400)
 
    contract.director_signed = True
    contract.director_signed_at = timezone.now()
    contract.director_signed_by_id = request.data.get("user_id")
    contract.save()
 
    _check_trio_and_notify_client(order_id)
 
    return Response(ContractSerializer(Contract.objects.get(order_id=order_id)).data)
 
 
@api_view(["PUT"])
def approve_contract(request, order_id):
    return sign_by_approver(request, order_id)
 
 
@api_view(["PUT"])
def sign_by_client(request, order_id):
    try:
        contract = Contract.objects.get(order_id=order_id)
    except Contract.DoesNotExist:
        return Response({"message": "Договор не найден"}, status=404)
    if not contract.is_trio_signed:
        return Response({"message": "Договор ещё не подписан всеми сторонами организации"}, status=400)
    if contract.client_signed:
        return Response({"message": "Клиент уже подписал"}, status=400)
 
    contract.client_signed = True
    contract.client_signed_at = timezone.now()
    contract.client_signed_by_id = request.data.get("user_id")
    contract.save()
 
    order = Order.objects.filter(id=order_id).first()
    if order:
        notification_services.notify_gen_director_for_signing(order_id, order.order_number)
 
    return Response(ContractSerializer(contract).data)

 
@api_view(["PUT"])
def sign_by_gen_director(request, order_id):
    try:
        contract = Contract.objects.get(order_id=order_id)
    except Contract.DoesNotExist:
        return Response({"message": "Договор не найден"}, status=404)
    if not contract.is_trio_signed:
        return Response({"message": "Тройка ещё не подписала договор"}, status=400)
    if not contract.client_signed:
        return Response({"message": "Клиент ещё не подписал договор"}, status=400)
    if contract.gen_director_signed:
        return Response({"message": "Ген.директор уже подписал"}, status=400)
 
    contract.gen_director_signed = True
    contract.gen_director_signed_at = timezone.now()
    contract.gen_director_signed_by_id = request.data.get("user_id")
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
def reject_contract(request, order_id):
    try:
        contract = Contract.objects.get(order_id=order_id)
    except Contract.DoesNotExist:
        return Response({"message": "Договор не найден"}, status=404)
 
    reason = request.data.get("reason")
    role = request.data.get("role") or "unknown"
 
    contract.status = "rejected"
    contract.rejected_by_role = role
    contract.rejected_reason = reason
    contract.save()
 
    order = Order.objects.filter(id=order_id).first()
    if order:
        order.status = "pending_contract"
        order.save()
        notification_services.notify_managers_rejected(order_id, order.order_number, reason or "Причина не указана")
 
    return Response(ContractSerializer(contract).data)
 
 
@api_view(["PUT"])
def annul_contract(request, order_id):
    try:
        contract = Contract.objects.get(order_id=order_id)
    except Contract.DoesNotExist:
        return Response({"message": "Договор не найден"}, status=404)
 
    contract.status = "annulled"
    contract.annulled_at = timezone.now()
    contract.annulled_by_id = request.data.get("user_id")
    contract.annulled_reason = request.data.get("reason")
    contract.save()
 
    order = Order.objects.filter(id=order_id).first()
    if order:
        order.status = "annulled"
        order.save()
 
    return Response(ContractSerializer(contract).data)
 
 
@api_view(["PUT"])
def terminate_contract(request, order_id):
    try:
        contract = Contract.objects.get(order_id=order_id)
    except Contract.DoesNotExist:
        return Response({"message": "Договор не найден"}, status=404)
 
    contract.status = "terminated"
    contract.terminated_at = timezone.now()
    contract.terminated_by_id = request.data.get("user_id")
    contract.terminated_reason = request.data.get("reason")
    contract.save()
 
    order = Order.objects.filter(id=order_id).first()
    if order:
        order.status = "terminated"
        order.save()
 
    return Response(ContractSerializer(contract).data)
 
 
@api_view(["GET"])
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
def download_certificate(request, order_id):
    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return Response(status=404)

    result = Result.objects.filter(order_id=order_id).first()

    pdf_bytes = pdf_service.generate_certificate_pdf(order, result)

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="certificate_{order_id}.pdf"'
    return response


@api_view(["GET"])
def download_invoice(request, order_id):
    try:
        order = Order.objects.get(id=order_id)
    except Order.DoesNotExist:
        return Response({"message": "Заявка не найдена"}, status=404)

    pdf_bytes = pdf_service.generate_invoice_pdf(order)

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="invoice_{order_id}.pdf"'
    return response


@api_view(["GET"])
def get_results_by_order(request, order_id):
    results = Result.objects.filter(order_id=order_id)
    return Response(ResultSerializer(results, many=True).data)