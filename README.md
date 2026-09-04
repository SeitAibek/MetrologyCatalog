# MetrologyCatalog

Каталог метрологических услуг и сопровождение заявки от подачи до выдачи
документов: договор с пятью подписями, счёт, приёмка в лабораторию, работа
метролога, сертификат. Django + DRF на бэкенде, React на фронте, PostgreSQL.

## Стек

| | |
|---|---|
| Бэкенд | Django 6.1, DRF 3.18, PostgreSQL (psycopg 3) |
| Аутентификация | собственный JWT (PyJWT + bcrypt), **не** `django.contrib.auth` |
| Документы | xhtml2pdf поверх Django-шаблонов, шрифт FreeSans |
| Фронт | React 19, TypeScript, Vite, Tailwind 3, Zustand, axios |

## Как поднять

Нужны Python 3.14, Node 20+ и PostgreSQL.

### Бэкенд

```bash
cd backend
python -m venv venv
./venv/Scripts/activate          # Windows; на Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
```

Создайте `backend/.env` (он в `.gitignore`):

```ini
DB_NAME=metrology
DB_USER=postgres
DB_PASSWORD=...
DB_HOST=localhost
DB_PORT=5432

JWT_SECRET=любая-длинная-строка
JWT_EXPIRATION_MS=86400000

# Реквизиты исполнителя — попадают в договор и счёт.
# Не заданы — в бланке будут пустые строки.
EXECUTOR_NAME=ТОО Метрологическая служба
EXECUTOR_BIN=...
EXECUTOR_ADDRESS=...
EXECUTOR_PHONE=...
EXECUTOR_BANK=...
```

```bash
./venv/Scripts/python.exe manage.py migrate
./venv/Scripts/python.exe manage.py seed      # демо-данные, необязательно
./venv/Scripts/python.exe manage.py runserver # http://localhost:8000
```

### Фронт

```bash
cd frontend
npm install
cp .env.example .env.local     # и поправьте VITE_API_URL на http://localhost:8000/api
npm run dev                    # http://localhost:5173
```

Порт `5173` не случайный: в `CORS_ALLOWED_ORIGINS` прописан только он. Если
Vite займёт `5174` (первый порт уже занят), запросы к API упрутся в CORS —
браузер покажет ошибку загрузки данных, хотя бэкенд жив.

### Тестовые пользователи

`manage.py seed` заводит лаборатории, услуги, компанию и девять пользователей.
Вход по ИИН, **пароль у всех `password`**:

| ИИН | Роль |
|---|---|
| `000000000001` | клиент |
| `000000000002`, `000000000003` | метрологи (разные лаборатории) |
| `000000000004` | менеджер |
| `000000000005` | директор |
| `000000000006` | ген. директор |
| `000000000007` | финансист |
| `000000000008` | согласующий |
| `000000000009` | администратор |

## Что где лежит

```
backend/
  config/        настройки, urls, middleware (в т.ч. 413 на большое тело)
  users/         пользователи, JWT (jwt_utils, authentication), роли
  companies/     компании клиентов
  laboratories/  лаборатории и филиалы
  catalog/       услуги, шаблоны дополнительных полей
  orders/        заявки, позиции, договоры, результаты, генерация PDF
  notifications/ уведомления
  devices/       приборы клиента
  msgs/          переписка по заявке
  templates/pdf/ бланки договора, счёта, сертификата
  fonts/         FreeSans.ttf для xhtml2pdf
frontend/src/
  pages/         экраны по ролям
  components/    Header (шапка + сайдбар), Brand, CustomFieldsForm, ProtectedRoute
  services/api.ts  axios-клиент и все вызовы
  store/         Zustand: сессия
  constants/     статусы заявки: подписи и цвета
```

## Роли и путь заявки

Восемь ролей: `client`, `metrolog`, `manager`, `director`, `gen_director`,
`financier`, `approver`, `admin`.

Пятнадцать статусов заявки: `draft` → `pending_contract` → `awaiting_approval`
→ `awaiting_payment` → `pending_delivery` → `awaiting_delivery` →
`received_in_lab` → `expertise` → `in_work` → `under_review` → `completed`,
плюс `revision`, `cancelled`, `annulled`, `terminated`.

Договор подписывают пятеро: согласующий, финансист, директор, клиент и
последним — генеральный директор. Направляет заявку в лабораторию **только**
директор (`assign_to_lab`).

## Что стоит знать до правок

Вещи, которые легко сломать, не зная о них.

**Аутентификация своя.** `users/authentication.py` разбирает JWT сам, юзер
берётся из своей таблицы `users`. `request.user` — это `users.models.User`, а
не `auth.User`: у него есть только своё свойство `is_authenticated`, ничего
другого из `django.contrib.auth` на нём нет. Роль проверяется классом прав
`has_role("manager", ...)` из `users/permissions.py` — он передаётся в
`@permission_classes`, а не вешается декоратором.

**Ответы camelCase, но не везде.** `djangorestframework_camel_case`
переименовывает ключи рекурсивно, включая содержимое `JSONField`. Для
`custom_fields_values` это ломало поиск по ключу поля, поэтому в
`JSON_CAMEL_CASE` стоит `ignore_fields`. Добавляете JSONField с
пользовательскими ключами — впишите его туда же.

**Вложения — base64 в `TextField`.** Ни `FileField`, ни S3 в проекте нет. У
каждого файла две колонки: содержимое и `<name>_file_name`. Отсюда:

- потолок тела запроса `DATA_UPLOAD_MAX_MEMORY_SIZE = 20 МиБ` в settings и
  `MAX_ATTACHMENT_MB` в `orders/views.py` двигаются только вместе — base64
  длиннее файла в 4/3 раза;
- эти колонки исключены из списковых выборок через `defer()`
  (`ATTACHMENT_CONTENT_FIELDS`), иначе список тянет десятки мегабайт;
- скачивается загруженное всегда как `application/octet-stream` —
  объявлять чужой файл как PDF по имени нельзя.

**Имена связанных сущностей.** Списки показывают `serviceName`, `labName`,
`clientName`, `assignedLabName` — они добавлены в `OrderSerializer`, а связи
подтягиваются одним запросом через `ORDER_NAME_RELATIONS`. Добавите ещё одно
имя — впишите связь туда же, иначе получите N+1.

**Коды ответов.** Договорённость по всему API: чужому объекту — `404` (не
подтверждаем существование), своему, но недоступному действию — `400`, не той
роли — `403`, без токена — `401`.

**Дополнительные поля услуги.** Схема живёт на `Service.custom_fields_schema`,
а при подаче её **снимок** копируется в `OrderItem.custom_fields_schema`.
Документы и формы читают снимок, а не текущий шаблон: заявка должна выглядеть
так, как её заполняли, даже если менеджер потом поменял шаблон услуги.

**Документы.** Один генератор — `orders/pdf_service.py`, бланки в
`templates/pdf/`. Блок приборов вынесен в общий `_order_items.html` и
включается и в договор, и в сертификат. xhtml2pdf **не читает**
`page-break-inside`; чтобы таблица не рвалась по-живому, используется его
собственный атрибут `repeat="1"` (это `repeatRows` у reportlab).

**Логотип.** Везде один компонент `components/Brand.tsx`, геометрия — в
`index.css` (`--brand-bar-h`, `--brand-bar-x`, классы `.brand-bar`,
`.brand-bar-offset`). Отступ считается от края окна, а не от центрированного
контейнера, иначе логотип разъезжается по страницам на широких экранах.

## Команды

```bash
# демо-данные
manage.py seed

# шаблоны дополнительных полей услуги
manage.py set_service_template --list
manage.py set_service_template --service-id 1 --schema-file schema.json
manage.py set_service_template --service-name "Поверка" --schema-json '[...]'
```

Схему полей можно править и из интерфейса: менеджер, экран «Шаблоны услуг».

## Проверки перед коммитом

```bash
cd backend  && ./venv/Scripts/python.exe manage.py check
cd backend  && ./venv/Scripts/python.exe manage.py makemigrations --check --dry-run
cd frontend && npx tsc -b && npm run build
```

Автотестов в проекте нет: изменения проверяются скриптами на `django.test.Client`
и прогоном экранов в браузере.

## Известные расхождения

- В `backend/.env` реквизиты исполнителя записаны ключами `executor.name`,
  `executor.bin` и т. д., а `settings.py` читает `EXECUTOR_NAME`,
  `EXECUTOR_BIN`. Пока ключи не переименованы, в договоре и счёте печатаются
  пустые БИН, адрес, телефон и банк.
- `DEBUG = True` и `SECRET_KEY` захардкожены в `config/settings.py` — перед
  выкладыванием наружу это надо вынести в окружение.
- Плановая дата (`due_date`) больше не заполняется формами, но всё ещё
  выводится на экранах метролога, директора, ген. директора и в отчётах.
