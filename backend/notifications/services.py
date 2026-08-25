from .models import Notification
from users.models import User
from orders import email_utils


def create(user_id: int, order_id: int | None, message: str, notification_type: str):
    Notification.objects.create(
        user_id=user_id,
        order_id=order_id,
        message=message[:255],
        notification_type=notification_type,
    )


def notify_managers_new_order(order_number: str):
    for manager in User.objects.filter(role="manager"):
        create(manager.id, None, f"Новая заявка {order_number} ожидает обработки", "order_status")


def notify_client_revision(client_id: int, order_id: int, order_number: str):
    create(client_id, order_id,
           f"Заявка {order_number} возвращена на доработку. Проверьте комментарий менеджера.",
           "order_status")
    client = User.objects.filter(id=client_id).first()
    if client and client.email:
        email_utils.send_returned_to_revision(client.email, client.full_name, order_number)


def notify_managers_resubmit(order_number: str):
    for manager in User.objects.filter(role="manager"):
        create(manager.id, None,
               f"Заявка {order_number} исправлена клиентом и ожидает повторной проверки",
               "order_status")


def notify_approvers_contract_ready(order_id: int, order_number: str):
    for approver in User.objects.filter(role="approver"):
        create(approver.id, order_id,
               f"Договор по заявке {order_number} ожидает вашего согласования",
               "approval_required")


def notify_parallel_approvers(order_id: int, order_number: str):
    message = f"Договор по заявке {order_number} ожидает вашей подписи"
    for role in ("approver", "financier", "director"):
        for u in User.objects.filter(role=role):
            create(u.id, order_id, message, "approval_required")


def notify_director_approved(order_id: int, order_number: str):
    for director in User.objects.filter(role="director"):
        create(director.id, order_id,
               f"Договор по заявке {order_number} согласован и ожидает вашей подписи",
               "approval_required")


def notify_managers_rejected(order_id: int, order_number: str, reason: str):
    for manager in User.objects.filter(role="manager"):
        create(manager.id, order_id,
               f"Договор по заявке {order_number} отклонён. Причина: {reason}",
               "order_status")


def notify_financiers_director_signed(order_id: int, order_number: str):
    for financier in User.objects.filter(role="financier"):
        create(financier.id, order_id,
               f"Договор по заявке {order_number} подписан директором. Сформируйте счёт на оплату.",
               "document_ready")


def notify_client_invoice_sent(client_id: int, order_id: int, order_number: str):
    create(client_id, order_id,
           f"Счёт на оплату по заявке {order_number} доступен в личном кабинете",
           "document_ready")
    client = User.objects.filter(id=client_id).first()
    if client and client.email:
        email_utils.send_invoice_ready(client.email, client.full_name, order_number)


def notify_financiers_receipt_uploaded(order_id: int, order_number: str):
    for financier in User.objects.filter(role="financier"):
        create(financier.id, order_id,
               f"Клиент загрузил чек об оплате по заявке {order_number}. Подтвердите оплату.",
               "receipt_uploaded")


def notify_payment_confirmed(order_id: int, order_number: str):
    for role in ("director", "manager"):
        for u in User.objects.filter(role=role):
            create(u.id, order_id,
                   f"Оплата по заявке {order_number} подтверждена. Направьте на исполнение.",
                   "payment_received")


def notify_assigned_to_lab(client_id: int, order_id: int, order_number: str, lab_name: str):
    create(client_id, order_id,
           f"Ваша заявка {order_number} направлена на исполнение в {lab_name}",
           "assigned_to_lab")
    client = User.objects.filter(id=client_id).first()
    if client and client.email:
        email_utils.send_assigned_to_lab(client.email, client.full_name, order_number, lab_name)
    for metrolog in User.objects.filter(role="metrolog"):
        create(metrolog.id, order_id,
               f"Новая заявка {order_number} направлена в вашу лабораторию ({lab_name})",
               "assigned_to_lab")


def notify_client_status_changed(client_id: int, order_id: int, order_number: str, status_label: str):
    create(client_id, order_id, f"Статус вашей заявки {order_number} изменён: {status_label}", "order_status")


def notify_client_completed(client_id: int, order_id: int, order_number: str):
    create(client_id, order_id,
           f"Заявка {order_number} выполнена. Скачайте документы в личном кабинете.",
           "document_ready")
    client = User.objects.filter(id=client_id).first()
    if client and client.email:
        email_utils.send_order_completed(client.email, client.full_name, order_number)


def notify_client_trio_signed(client_id: int, order_id: int, order_number: str):
    create(client_id, order_id,
           f"Договор по заявке {order_number} подписан организацией. Теперь ваша очередь подписать.",
           "document_ready")
    client = User.objects.filter(id=client_id).first()
    if client and client.email:
        email_utils.send_contract_ready(client.email, client.full_name, order_number)


def notify_gen_director_for_signing(order_id: int, order_number: str):
    for u in User.objects.filter(role="gen_director"):
        create(u.id, order_id,
               f"Договор по заявке {order_number} подписан клиентом. Ожидается ваша финальная подпись.",
               "approval_required")


def notify_financiers_contract_signed(order_id: int, order_number: str):
    for u in User.objects.filter(role="financier"):
        create(u.id, order_id,
               f"Договор по заявке {order_number} полностью подписан. Сформируйте счёт на оплату.",
               "document_ready")


def notify_manager_invoice_ready(order_id: int, order_number: str):
    for u in User.objects.filter(role="manager"):
        create(u.id, order_id,
               f"Счёт по заявке {order_number} сформирован финансистом. Отправьте клиенту.",
               "document_ready")


def notify_manager_payment_confirmed(order_id: int, order_number: str):
    for u in User.objects.filter(role="manager"):
        create(u.id, order_id, f"Оплата по заявке {order_number} подтверждена финансистом.", "payment_received")


def notify_director_to_assign(order_id: int, order_number: str):
    for u in User.objects.filter(role="director"):
        create(u.id, order_id,
               f"Оплата по заявке {order_number} получена. Направьте заявку на исполнение.",
               "payment_received")


def notify_managers_new_message(order_id: int, order_number: str, sender_name: str):
    for u in User.objects.filter(role="manager"):
        create(u.id, order_id, f"Новое сообщение от {sender_name} по заявке {order_number}", "order_status")


def notify_client_new_message(client_id: int, order_id: int, order_number: str):
    create(client_id, order_id, f"Менеджер отправил вам сообщение по заявке {order_number}", "order_status")