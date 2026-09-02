from django.db import migrations

# Снимок схемы, который эта миграция проставляет существующим позициям.
# Ключи совпадают с именами старых колонок намеренно — по ним же потом
# настраивается сам шаблон услуги через update_service_template, чтобы
# старые и новые позиции читались одним и тем же кодом без сопоставления
# разных ключей на один смысл.
FIELD_SCHEMA = [
    {"key": "manufacturer_name", "label": "Полное наименование производства",
     "type": "text", "required": True, "scope": "item"},
    {"key": "manufacturer_address", "label": "Адрес производства",
     "type": "text", "required": True, "scope": "item"},
    {"key": "manufacturer_country", "label": "Страна производства",
     "type": "text", "required": True, "scope": "item"},
    {"key": "metrological_characteristics", "label": "Метрологические характеристики",
     "type": "textarea", "required": True, "scope": "item"},
]

OLD_FIELD_KEYS = [f["key"] for f in FIELD_SCHEMA]


def migrate_values(apps, schema_editor):
    OrderItem = apps.get_model("orders", "OrderItem")
    touched = 0
    skipped = 0
    for item in OrderItem.objects.all():
        values = {key: getattr(item, key) for key in OLD_FIELD_KEYS if getattr(item, key)}
        if values:
            item.custom_fields_values = values
            item.custom_fields_schema = FIELD_SCHEMA
            item.save(update_fields=["custom_fields_values", "custom_fields_schema"])
            touched += 1
        else:
            skipped += 1
    print(f"\n  custom-fields: перенесено {touched} позиций, пропущено (все поля пусты) {skipped}")


class Migration(migrations.Migration):

    dependencies = [
        ("orders", "0006_order_custom_fields_schema_and_more"),
    ]

    operations = [
        migrations.RunPython(migrate_values, migrations.RunPython.noop),
    ]
