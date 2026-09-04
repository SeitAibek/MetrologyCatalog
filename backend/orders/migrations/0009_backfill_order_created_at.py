import re
from datetime import datetime, timezone

from django.db import migrations

# Номер заявки генерируется как ORD-<epoch_ms> (orders/views.py, create_order),
# поэтому у заявок, заведённых через приложение, момент подачи записан прямо в
# номере. Это единственный след даты создания до появления колонки created_at.
#
# Ровно 13 цифр — столько в миллисекундах эпохи с 2001 по 2286 год. Рукописные
# номера вроде ORD-001 под шаблон не подходят: даты у них нет и взять её
# неоткуда, поле зануляется. Прочерк в карточке честнее, чем момент применения
# этой миграции, выданный за дату подачи.
#
# Занулять приходится явно, и это не перестраховка: AddField для поля с
# auto_now_add пишет всем существующим строкам timezone.now() как значение
# колонки (BaseDatabaseSchemaEditor._effective_default), и null=True от этого
# не спасает — пустой колонка после 0008 не бывает.
ORDER_NUMBER_WITH_TIMESTAMP = re.compile(r"^ORD-(\d{13})$")


def backfill_created_at(apps, schema_editor):
    Order = apps.get_model("orders", "Order")
    filled = 0
    emptied = []
    for order in Order.objects.all():
        match = ORDER_NUMBER_WITH_TIMESTAMP.match(order.order_number or "")
        if not match:
            Order.objects.filter(pk=order.pk).update(created_at=None)
            emptied.append(order.order_number)
            continue
        # USE_TZ=True и TIME_ZONE='UTC': epoch разбирается в UTC и хранится в
        # UTC, так что дата не съезжает на сутки у поданных ночью.
        submitted = datetime.fromtimestamp(int(match.group(1)) / 1000, tz=timezone.utc)
        # update, а не save: минуя pre_save, значение записывается как есть.
        Order.objects.filter(pk=order.pk).update(created_at=submitted)
        filled += 1
    print(f"\n  created_at: проставлено из номера {filled}, "
          f"занулено {len(emptied)} {emptied}")


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0008_order_created_at"),
    ]

    operations = [
        migrations.RunPython(backfill_created_at, migrations.RunPython.noop),
    ]
