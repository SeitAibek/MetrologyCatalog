from django.core.mail import send_mail


def _translate_status(status: str) -> str:
    translations = {
        "pending_contract": "Ожидает создания договора",
        "revision": "Возвращена на доработку",
        "awaiting_approval": "На согласовании",
        "awaiting_payment": "Ожидает оплаты",
        "awaiting_delivery": "Ожидает доставки",
        "received_in_lab": "Принято в лабораторию",
        "in_work": "В работе",
        "under_review": "На проверке",
        "completed": "Завершено",
        "cancelled": "Отменено",
        "annulled": "Аннулировано",
        "terminated": "Расторгнуто",
    }
    return translations.get(status, status)


def _send(to_email: str, subject: str, text: str):
    send_mail(subject=subject, message=text, from_email=None, recipient_list=[to_email])


def send_status_update(to_email: str, full_name: str, order_number: str, new_status: str):
    _send(
        to_email,
        f"Обновление статуса заявки #{order_number}",
        f"Уважаемый(ая) {full_name},\n\n"
        f"Статус вашей заявки #{order_number} изменён на: {_translate_status(new_status)}\n\n"
        f"С уважением,\nМетрологическая служба",
    )


def send_order_completed(to_email: str, full_name: str, order_number: str):
    _send(
        to_email,
        f"Заявка #{order_number} завершена",
        f"Уважаемый(ая) {full_name},\n\n"
        f"Ваша заявка #{order_number} успешно завершена.\n"
        f"Вы можете скачать сертификат в личном кабинете.\n\n"
        f"С уважением,\nМетрологическая служба",
    )


def send_contract_ready(to_email: str, full_name: str, order_number: str):
    _send(
        to_email,
        f"Договор по заявке #{order_number} готов к подписанию",
        f"Уважаемый(ая) {full_name},\n\n"
        f"Договор по вашей заявке #{order_number} подготовлен и ожидает вашей подписи.\n"
        f"Войдите в личный кабинет для ознакомления и подписания.\n\n"
        f"С уважением,\nМетрологическая служба",
    )


def send_returned_to_revision(to_email: str, full_name: str, order_number: str):
    _send(
        to_email,
        f"Заявка #{order_number} возвращена на доработку",
        f"Уважаемый(ая) {full_name},\n\n"
        f"Ваша заявка #{order_number} возвращена на доработку. "
        f"Пожалуйста, войдите в личный кабинет, ознакомьтесь с комментарием менеджера "
        f"и внесите необходимые исправления.\n\n"
        f"С уважением,\nМетрологическая служба",
    )


def send_invoice_ready(to_email: str, full_name: str, order_number: str):
    _send(
        to_email,
        f"Счёт на оплату по заявке #{order_number}",
        f"Уважаемый(ая) {full_name},\n\n"
        f"Счёт на оплату по заявке #{order_number} доступен в вашем личном кабинете.\n"
        f"Пожалуйста, произведите оплату и прикрепите подтверждение.\n\n"
        f"С уважением,\nМетрологическая служба",
    )


def send_assigned_to_lab(to_email: str, full_name: str, order_number: str, lab_name: str):
    _send(
        to_email,
        f"Заявка #{order_number} направлена на исполнение",
        f"Уважаемый(ая) {full_name},\n\n"
        f"Ваша заявка #{order_number} направлена на исполнение в {lab_name}.\n"
        f"Вы можете отслеживать статус в личном кабинете.\n\n"
        f"С уважением,\nМетрологическая служба",
    )