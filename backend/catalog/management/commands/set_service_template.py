"""
Назначает Service.custom_fields_schema напрямую через ORM, в обход HTTP/JWT -
чтобы настроить схему на любой БД (включая другую среду) без похода за
токеном менеджера. Валидация схемы - та же функция, что и у
update_service_template, так что расхождения между командой и эндпоинтом
быть не может.

Примеры:
  python manage.py set_service_template --list
  python manage.py set_service_template --service-id 5 --schema-file schema.json
  python manage.py set_service_template --service-name "Испытания для целей утверждения типа" --schema-json '[...]'
"""
import json

from django.core.management.base import BaseCommand, CommandError

from catalog.models import Service
from catalog.views import _validate_custom_fields_schema


class Command(BaseCommand):
    help = "Назначает схему кастомных полей услуге напрямую через ORM"

    def add_arguments(self, parser):
        parser.add_argument("--service-id", type=int)
        parser.add_argument("--service-name", type=str, help="Точное имя услуги, если id не задан")
        parser.add_argument("--schema-file", type=str, help="Путь к JSON-файлу со схемой (список полей)")
        parser.add_argument("--schema-json", type=str, help="Схема как JSON-строка (список полей)")
        parser.add_argument("--list", action="store_true", help="Показать услуги с id и наличием схемы")

    def handle(self, *args, **options):
        if options["list"] or not (options["service_id"] or options["service_name"]):
            self.stdout.write("Услуги:")
            for s in Service.objects.order_by("id"):
                has_schema = f"{len(s.custom_fields_schema)} полей" if s.custom_fields_schema else "без схемы"
                self.stdout.write(f"  id={s.id}  {s.name}  ({has_schema})")
            if not (options["service_id"] or options["service_name"]):
                return

        service = self._resolve_service(options)

        if not options["schema_file"] and not options["schema_json"]:
            raise CommandError("Укажите --schema-file или --schema-json")

        if options["schema_file"]:
            with open(options["schema_file"], encoding="utf-8") as f:
                schema = json.load(f)
        else:
            schema = json.loads(options["schema_json"])

        error = _validate_custom_fields_schema(schema)
        if error:
            raise CommandError(f"Схема не прошла валидацию: {error}")

        service.custom_fields_schema = schema
        service.save(update_fields=["custom_fields_schema"])

        self.stdout.write(self.style.SUCCESS(
            f"Услуге «{service.name}» (id={service.id}) назначена схема из {len(schema)} полей"
        ))

    def _resolve_service(self, options):
        if options["service_id"]:
            try:
                return Service.objects.get(id=options["service_id"])
            except Service.DoesNotExist:
                raise CommandError(f"Услуга id={options['service_id']} не найдена")

        matches = list(Service.objects.filter(name=options["service_name"]))
        if not matches:
            raise CommandError(f"Услуга с именем «{options['service_name']}» не найдена")
        if len(matches) > 1:
            ids = ", ".join(str(s.id) for s in matches)
            raise CommandError(f"Найдено несколько услуг с этим именем (id: {ids}) - укажите --service-id")
        return matches[0]
