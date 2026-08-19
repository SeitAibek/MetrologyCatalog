"""
Management command для наполнения БД демо-данными.
Адаптировано из старого database.sql под текущую схему (с id_number вместо
обязательного unique email, с Message-моделью и т.д.)

Запуск: python manage.py seed

Пароль для всех тестовых юзеров: password
(используется готовый bcrypt-хеш из исходного дампа — он совместим с нашей
проверкой через bcrypt.checkpw, так что можно логиниться сразу)
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from laboratories.models import Laboratory
from catalog.models import Service
from companies.models import Company
from users.models import User
from orders.models import Order, OrderItem, Contract, Result

# Готовый bcrypt-хеш пароля "password" из исходного дампа
PASSWORD_HASH = "$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi"


class Command(BaseCommand):
    help = "Наполняет БД демо-данными (лаборатории, услуги, компании, юзеры, заказы)"

    @transaction.atomic
    def handle(self, *args, **options):
        # ─── Лаборатории ──────────────────────────────────────────────
        labs_data = [
            ("Метрологическая лаборатория №1", "г. Астана, ул. Абая 5", "+77001111111", "Астана"),
            ("Метрологическая лаборатория №2", "г. Алматы, ул. Достык 10", "+77002222222", "Алматы"),
            ("Метрологическая лаборатория №3", "г. Караганда, ул. Ленина 3", "+77003111111", "Караганда"),
            ("Метрологическая лаборатория №4", "г. Актобе, ул. Абилхайыр хана 12", "+77004111111", "Актобе"),
        ]
        labs = []
        for name, address, phone, city in labs_data:
            lab, _ = Laboratory.objects.get_or_create(
                name=name, defaults={"address": address, "phone": phone, "city": city}
            )
            labs.append(lab)
        self.stdout.write(self.style.SUCCESS(f"Лабораторий: {len(labs)}"))

        # ─── Услуги ───────────────────────────────────────────────────
        services_data = [
            ("Испытания для целей утверждения типа", "Испытания средств измерений для утверждения типа", "Средства измерений", 1, 0, "ГОСТ 8.610-2012"),
            ("Метрологическая аттестация средств измерений", "Аттестация средств измерений в лабораторных условиях", "Средства измерений", 2, 0, "ГОСТ 8.016-2021"),
            ("Методики выполнения измерений", "Разработка и аттестация методик выполнения измерений", "Средства измерений", 3, 0, "ГОСТ 8.497-2009"),
            ("Аттестация испытательного оборудования", "Аттестация испытательного и измерительного оборудования", "Испытательное оборудование", 4, 0, "ГОСТ 8.497-2009"),
            ("Допуск к применению стандартного образца", "Экспертиза и допуск зарубежных стандартных образцов", "Стандартные образцы", 5, 0, "ГОСТ 8.497-2009"),
            ("Поверка средств измерений", "Поверка средств измерений в соответствии с ГОСТ", "Средства измерений", 6, 0, "ГОСТ 8.497-2009"),
            ("Калибровка средств измерений", "Калибровка средств измерений по эталонам", "Средства измерений", 1, 1, "ГОСТ 8.497-2009"),
            ("Изготовление поверительных клейм", "Изготовление и выдача поверительных клейм", "Поверительные клейма", 2, 1, "ГОСТ 8.497-2009"),
            ("Межлабораторные сличения", "Организация и проведение межлабораторных сличений", "Средства измерений", 3, 1, "ГОСТ 8.497-2009"),
            ("Аттестация поверителей средств измерений", "Аттестация и переаттестация поверителей средств измерений", "Средства измерений", 4, 1, "ГОСТ 8.497-2009"),
            ("Признание результатов испытаний", "Порядок признания результатов испытаний, первичной поверки и метрологической аттестации", "Средства измерений", 5, 1, "ГОСТ 8.497-2009"),
            ("Признание результатов поверки зарубежных орг.", "Признание результатов калибровки зарубежными метрологическими организациями", "Средства измерений", 6, 1, "ГОСТ 8.362-2013"),
        ]
        services = []
        for name, desc, mtype, duration, lab_idx, standard in services_data:
            service, _ = Service.objects.get_or_create(
                name=name,
                defaults={
                    "description": desc,
                    "measurement_type": mtype,
                    "duration_days": duration,
                    "lab": labs[lab_idx],
                    "standard": standard,
                    "is_active": True,
                },
            )
            services.append(service)
        self.stdout.write(self.style.SUCCESS(f"Услуг: {len(services)}"))

        # ─── Компания ─────────────────────────────────────────────────
        company, _ = Company.objects.get_or_create(
            bin="123456789012",
            defaults={
                "name": "ТОО Тест Компания",
                "address": "г. Астана, ул. Пушкина 1",
                "phone": "+77003333333",
                "email": "test@company.kz",
            },
        )
        self.stdout.write(self.style.SUCCESS("Компания создана"))

        # ─── Пользователи ─────────────────────────────────────────────
        # (email, role, full_name, phone, company, lab)
        users_data = [
            ("000000000001", "client@test.kz", "client", "Клиентов Клиент", "+77004444444", company, None),
            ("000000000002", "metrolog@test.kz", "metrolog", "Метробаев Лог", "+77005555555", None, labs[0]),
            ("000000000003", "metrolog2@test.kz", "metrolog", "Логов Метр", "+77008888888", None, labs[1]),
            ("000000000004", "manager@metrology.kz", "manager", "Менеджерович Менеджер", "+77006666666", None, None),
            ("000000000005", "director@metrology.kz", "director", "Директоров Директор", "+77009999999", None, None),
            ("000000000006", "gen_director@metrology.kz", "gen_director", "Генеральный Директоров", "+77009000000", None, None),
            ("000000000007", "financier@metrology.kz", "financier", "Финансов Финансист", "+77001234567", None, None),
            ("000000000008", "approver@metrology.kz", "approver", "Согласуев Согласующий", "+77007654321", None, None),
            ("000000000009", "admin@metrology.kz", "admin", "Админский Стратор", "+77007777777", None, None),
        ]
        users = {}
        for id_number, email, role, full_name, phone, comp, lab in users_data:
            user, _ = User.objects.get_or_create(
                id_number=id_number,
                defaults={
                    "email": email,
                    "password_hash": PASSWORD_HASH,
                    "role": role,
                    "full_name": full_name,
                    "phone": phone,
                    "company_id": comp.id if comp else None,
                    "lab_id": lab.id if lab else None,
                    "is_active": True,
                },
            )
            users[role + ("2" if role == "metrolog" and "2" not in users else "")] = user
        self.stdout.write(self.style.SUCCESS(f"Пользователей: {len(users_data)} (пароль для всех: password)"))

        client = User.objects.get(id_number="000000000001")
        metrolog1 = User.objects.get(id_number="000000000002")

        # ─── Заказы ───────────────────────────────────────────────────
        orders_data = [
            ("ORD-001", client, services[0], labs[0], "completed", "2026-03-15"),
            ("ORD-002", client, services[1], labs[0], "in_work", "2026-03-25"),
            ("ORD-003", client, services[2], labs[1], "awaiting_payment", "2026-04-01"),
            ("ORD-004", client, services[3], labs[1], "pending_contract", "2026-04-10"),
        ]
        orders = []
        for number, cl, service, lab, status, due_date in orders_data:
            order, _ = Order.objects.get_or_create(
                order_number=number,
                defaults={
                    "client": cl, "service": service, "lab": lab,
                    "status": status, "due_date": due_date,
                },
            )
            orders.append(order)
        self.stdout.write(self.style.SUCCESS(f"Заказов: {len(orders)}"))

        # ─── Позиции заказов ──────────────────────────────────────────
        items_data = [
            (orders[0], "Манометр", "МП-100", "SN-001", 1),
            (orders[1], "Термометр", "ТЛ-4", "SN-002", 1),
            (orders[2], "Амперметр", "Э-378", "SN-003", 1),
            (orders[3], "Вольтметр", "В-7-78", "SN-004", 1),
        ]
        for order, device_type, model, serial, qty in items_data:
            OrderItem.objects.get_or_create(
                order=order, serial_number=serial,
                defaults={"device_type": device_type, "model": model, "quantity": qty},
            )
        self.stdout.write(self.style.SUCCESS("Позиции заказов созданы"))

        # ─── Договоры ─────────────────────────────────────────────────
        contracts_data = [
            (orders[0], "CNT-001", "signed", True, True, True, True, True),
            (orders[1], "CNT-002", "draft", False, False, False, False, False),
            (orders[2], "CNT-003", "signed", True, True, True, True, True),
            (orders[3], "CNT-004", "draft", False, False, False, False, False),
        ]
        for order, number, status, client_s, director_s, approver_s, financier_s, gen_s in contracts_data:
            Contract.objects.get_or_create(
                order=order,
                defaults={
                    "contract_number": number, "status": status,
                    "client_signed": client_s, "director_signed": director_s,
                    "approver_signed": approver_s, "financier_signed": financier_s,
                    "gen_director_signed": gen_s,
                },
            )
        self.stdout.write(self.style.SUCCESS("Договоры созданы"))

        # ─── Результат для завершённого заказа ─────────────────────────
        Result.objects.get_or_create(
            order=orders[0],
            defaults={
                "result_type": "certificate",
                "metrologist": metrolog1,
                "is_signed": True,
            },
        )
        self.stdout.write(self.style.SUCCESS("Результаты созданы"))

        self.stdout.write(self.style.SUCCESS("\n✅ Готово! Все тестовые юзеры логинятся паролем: password"))
        self.stdout.write("ИИН юзеров: 000000000001 (client) ... 000000000009 (admin)")
