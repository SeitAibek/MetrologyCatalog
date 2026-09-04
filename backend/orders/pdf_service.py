import tempfile
from io import BytesIO
from xhtml2pdf import pisa
from django.template.loader import render_to_string
from django.utils import timezone
from django.conf import settings
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

import xhtml2pdf.files as _pisa_files

def _patched_get_named_file(self):
    if not self.notFound():
        if getattr(self, "local", None):
            return self.local
        if not getattr(self, "tmp_file", None):
            f = self.getFile()
            try:
                f.seek(0)
            except Exception:
                pass
            data = f.read()
            self.tmp_file = tempfile.NamedTemporaryFile(delete=False)
            self.tmp_file.write(data)
            self.tmp_file.close()
        return self.tmp_file.name

_pisa_files.pisaFileObject.getNamedFile = _patched_get_named_file

def _link_callback(uri, rel):
    if uri.startswith(str(settings.BASE_DIR)):
        return uri
    return str(settings.BASE_DIR / uri.lstrip("/"))


def _order_items_context(order):
    """Позиции заявки для документов: регулярные поля прибора плюс
    дополнительные — из СНИМКА схемы, снятого при подаче, а не из текущего
    шаблона услуги. Документ по старой заявке должен выглядеть так, как её
    заполняли, даже если менеджер потом поменял шаблон.

    Значения, ключей которых в снимке нет (шаблон менялся), не печатаются —
    подписи для них взять неоткуда. Поле снимка с пустым значением печатается
    прочерком: в бланке исчезнувшая строка выглядит так, будто поле не
    запрашивали, а прочерк честно показывает "запрошено, не заполнено".
    """
    items = []
    for item in order.orderitem_set.all().order_by("id"):
        values = item.custom_fields_values or {}
        extra = []
        for field in item.custom_fields_schema or []:
            key = field.get("key")
            if not key:
                continue
            raw = values.get(key)
            text = "" if raw is None else str(raw).strip()
            extra.append({"label": field.get("label") or key, "value": text or "—"})

        items.append({
            "device_type": item.device_type or "—",
            "model": item.model or "—",
            "serial_number": item.serial_number or "—",
            "quantity": item.quantity,
            "extra": extra,
        })
    return items


def generate_contract_pdf(order, contract) -> bytes:
    client = order.client
    service = order.service

    context = {
        "contract": contract,
        "order": order,
        "client_name": client.full_name if client else "—",
        "client_phone": client.phone if client and client.phone else "—",
        "client_email": client.email if client else "—",
        "service_name": service.name if service else "—",
        "service_description": service.description if service and service.description else "—",
        "service_standard": service.standard if service and service.standard else "—",
        "order_items": _order_items_context(order),
        "executor_name": settings.EXECUTOR_NAME,
        "executor_bin": settings.EXECUTOR_BIN,
        "executor_address": settings.EXECUTOR_ADDRESS,
        "executor_phone": settings.EXECUTOR_PHONE,
        "executor_bank": settings.EXECUTOR_BANK,
    }

    html = render_to_string("pdf/contract.html", context)

    result = BytesIO()
    pisa.CreatePDF(html, dest=result, link_callback=_link_callback)
    return result.getvalue()


def generate_certificate_pdf(order, result) -> bytes:
    document_titles = {
        "certificate": "Сертификат",
        "protocol": "Протокол",
        "report": "Отчёт",
    }
    document_title = document_titles.get(result.result_type if result else None, "Документ")

    context = {
        "order": order,
        "result": result,
        "document_title": document_title,
        "order_items": _order_items_context(order),
    }

    html = render_to_string("pdf/certificate.html", context)

    output = BytesIO()
    pisa.CreatePDF(html, dest=output, link_callback=_link_callback)
    return output.getvalue()


def generate_invoice_pdf(order) -> bytes:
    client = order.client
    service = order.service

    invoice_total = order.price if order.price and order.price > 0 else 0

    today = timezone.now().strftime("%d.%m.%Y")
    invoice_number = f"INV-{order.id}-{timezone.now().strftime('%d%m%Y')}"

    context = {
        "invoice_number": invoice_number,
        "today": today,
        "order_number": order.order_number,
        "invoice_total": f"{invoice_total:.2f}",
        "client_name": client.full_name if client else "—",
        "client_phone": client.phone if client and client.phone else "—",
        "client_email": client.email if client else "—",
        "service_name": service.name if service else "—",
        "executor_name": settings.EXECUTOR_NAME,
        "executor_bin": settings.EXECUTOR_BIN,
        "executor_address": settings.EXECUTOR_ADDRESS,
        "executor_phone": settings.EXECUTOR_PHONE,
        "executor_bank": settings.EXECUTOR_BANK,
    }

    html = render_to_string("pdf/invoice.html", context)

    result = BytesIO()
    pisa.CreatePDF(html, dest=result, link_callback=_link_callback)
    return result.getvalue()