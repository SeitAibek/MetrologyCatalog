# Design: "Заявка и взаимодействие" — экспертиза СИ в существующем флоу заказов

## Контекст и цель

Проект MetrologyCatalog реализует заказы через `Order`/`OrderItem`/`Contract`
(Django + DRF, PostgreSQL) с фронтендом на React 19 + TypeScript + Tailwind.
Нужно расширить текущий флоу заявки под процесс из официальной формы
Казстандарта: клиент подаёт данные о СИ и вложения, менеджер/согласующие
проводят договор (без изменений), директор назначает лабораторию и конкретного
метролога, назначенный метролог проводит экспертизу техдокументации и ведёт
все дальнейшие работы по заявке.

Явное ограничение объёма: **не создаём новых моделей/сущностей** — расширяем
`Order`, `OrderItem` и существующую статус-машину `Order.Status`. Роли
`approver`, `financier`, `gen_director` продолжают работать по текущей
контрактной цепочке без изменений; `gen_director` не получает никакого нового
функционала в рамках этой задачи.

## Из чего исходим (текущее состояние)

- `Order.status` — `CharField` с `Status(TextChoices)`
  (`backend/orders/models.py:5-19`), 14 значений, без выделенного метода
  перехода — переходы делаются ad hoc в `orders/views.py`.
- `Order.metrologist` (`models.py:33-36`) — FK на `User`, `null=True`,
  **уже существует**, но сегодня нигде не заполняется ни одной вьюхой.
- `assign_to_lab` (`views.py:492-522`) — единственная точка, где
  `awaiting_delivery → received_in_lab`; сегодня принимает только `lab_id`.
- `update_order_status` (`views.py:237-260`, роли `client`/`metrolog`) —
  принимает любое значение из `Order.Status.values` без проверки допустимости
  перехода и без проверки владения заказом.
- `orders_list` GET (`views.py:110-120`, роли `manager`/`metrolog`) — сегодня
  фильтрует по `assigned_lab_id` через query-параметр `labId`; используется
  `Queue.tsx` как `user.role === 'metrolog' ? user.labId : undefined`.
- Роль `metrolog` **уже существует** в `User.ROLE_CHOICES`
  (`backend/users/models.py:4-13`) с работающими `/queue` (`Queue.tsx`) и
  `create_result` — новых ролей заводить не нужно.
- Вложения в проекте хранятся по единственному существующему паттерну:
  `TextField` с base64 + `CharField` с именем файла, без `FileField`/S3
  (пример: `Contract.contract_file`/`contract_file_name`,
  `Order.payment_receipt`/`payment_receipt_name`); размер проверяется в
  view (`upload_receipt` — 7MB, `contract_detail` — 10MB).
- Все ретрофит-поля в существующих миграциях добавлены как
  `null=True, blank=True` без бэкфилла (кроме единственного исключения —
  `Contract.created_at`, не относящегося к этой задаче).

## Что не трогаем

- Пятиэтапную цепочку подписания договора (`director`, `approver`,
  `financier`, `client`, `gen_director` — `Contract` модель и вьюхи
  `sign_by_*`, `reject_contract`, `_close_contract`).
- Момент и способ выставления счёта (`send_invoice`, `invoice_sent`,
  `set_price`, `upload_receipt`, `confirm_payment`).
- Статусы `pending_contract … awaiting_payment … awaiting_delivery`.
- Мёртвый статус `awaiting_director` — остаётся неиспользуемым, не
  переосмысляем его под новый шаг.
- Роль и функционал `gen_director` — только существующая подпись в цепочке
  договора.

## Статус-машина: один новый статус

```
... → awaiting_delivery → received_in_lab → expertise (NEW) → in_work → under_review → completed
```

- `Order.Status` (`models.py:5-19`) получает
  `EXPERTISE = "expertise", "Expertise"`, размещённый после
  `RECEIVED_IN_LAB` для читаемости enum.
- `received_in_lab → expertise` — обычный переход через уже существующий
  generic `update_order_status`; отдельный endpoint не нужен, т.к. просто
  добавление значения в `Status.choices` делает его валидным для этой вьюхи.
- `expertise → in_work` — переход только через новый `submit_expertise`
  (см. ниже), т.к. требует сохранения двух файлов и текста заключения
  атомарно со сменой статуса.
- В `Queue.tsx` `statusFlow` расширяется:
  `received_in_lab: 'expertise', expertise: 'in_work', in_work: 'under_review', under_review: 'completed'`.
  Экспертиза обрабатывается в том же `Queue.tsx`, что и остальные этапы
  метролога — отдельная страница `Metrolog.tsx` не создаётся.

Известное ограничение (сознательно наследуем, не расширяем задачу): как и
сегодня для `in_work → under_review → completed`, `update_order_status` не
проверяет допустимость конкретного перехода — технически PUT с произвольным
статусом мог бы пропустить `expertise`. Это уже верно для всей цепочки
`received_in_lab…completed` в текущем коде; фронтенд управляет порядком
через `statusFlow`. Ownership-проверка (ниже) не даёт постороннему метрологу
менять статус чужого заказа, но не запрещает назначенному метрологу
пропустить свой собственный шаг экспертизы через прямой PUT. Оставляем как
есть, в духе существующей нестрогости кода.

## Видимость и владение — реальное ограничение доступа

`Order.metrologist` перестаёт быть "полем для галочки": с момента назначения
директором видеть и вести заказ может только назначенный метролог, а не вся
лаборатория. Это относится к `received_in_lab` и всем статусам после него.

Изменения:

1. **`orders_list` GET** (`views.py:110-120`): при `request.user.role ==
   "metrolog"` игнорировать query-параметр `labId` и всегда возвращать
   `Order.objects.filter(metrologist_id=request.user.id)`. Роль `manager`
   продолжает получать `assigned_lab_id`-фильтр или все заказы, без
   изменений.
2. **`update_order_status`** (`views.py:237-260`): при
   `request.user.role == "metrolog"` дополнительно требовать
   `order.metrologist_id == request.user.id`, иначе 403. Без этой проверки
   отфильтрованный список — только фасад: чужой метролог всё ещё мог бы
   слать PUT напрямую по известному `id` заказа.
3. **`submit_expertise`** (новая вьюха): та же ownership-проверка как
   обязательное условие, наравне с проверкой статуса.

Роль `client` в `update_order_status` (используется для отмены заказа)
изменений не касается.

## Назначение директором: СП + ИСП

`assign_to_lab` (`views.py:492-522`) меняется с "опционально можно было бы
завести исполнителя" на обязательное назначение обоих:

- Существующий параметр `lab_id` — назначение СП (лаборатории), без
  изменений в семантике.
- Новый обязательный параметр `metrologist_id` — назначение ИСП. Валидация:
  пользователь существует, `role == "metrolog"`, `is_active == True`,
  `lab_id` совпадает с выбранной лабораторией. При отсутствии или
  несоответствии — 400 с понятным сообщением, ни один из атомарных F
  (`assigned_lab_id`, `metrologist_id`, `status`) не применяется.
- При успехе: `order.assigned_lab_id`, `order.assigned_at`,
  `order.metrologist_id` и `order.status = "received_in_lab"` сохраняются
  одним `save()`, как и сегодня.

Поскольку `metrologist_id` становится обязательным параметром
`assign_to_lab`, право вызывать этот эндпоинт сужается до **только
`director`** — `gen_director` убирается из `permission_classes`.

Причина: `GenDirector.tsx` сегодня тоже вызывает `PUT
/orders/<id>/assign-lab/`, но передаёт только `labId` (см. `handleAssign`,
`GenDirector.tsx:117-130`, и кнопку `GenDirector.tsx:356-364`). Раз
`gen_director` в этом процессе не участвует (его роль — только
существующая подпись в контрактной цепочке), правильный выбор — не
чинить `GenDirector.tsx` под новый обязательный параметр, а убрать у него
это действие вовсе: после сужения роли `assign_to_lab` до `director`
кнопка в `GenDirector.tsx` начала бы просто получать 403, то есть вкладка
"Направить на исполнение" стала бы мёртвым UI. Поэтому вкладка "assign"
целиком удаляется из `GenDirector.tsx` — остаётся только "Финальное
подписание" (`activeTab`, `assignOrders`, `laboratories`, `selectedLabs`,
`assigning`, `handleAssign` и связанная разметка убираются; `fetchAll`
перестаёт грузить `awaiting_delivery` и лаборатории).

Для UI выбора метролога — новая вьюха:

- `get_metrologists_by_lab(request, lab_id)` — **только роль `director`**
  (не `gen_director` — он не участвует в этом процессе, его роль
  ограничена существующей подписью в контрактной цепочке).
  `GET /api/users/metrologists/<lab_id>/`, зеркалит по структуре
  `get_clients` (`users/views.py:264-268`):
  `User.objects.filter(role="metrolog", lab_id=lab_id, is_active=True)`,
  сериализуется через существующий `UserSerializer`.
- Роут добавляется в `backend/config/urls.py` внутри существующего блока
  `path("api/users/", include([...]))` (там же, где `clients/`).

`Director.tsx`, вкладка "Направить на исполнение": после выбора лаборатории
из `<select>` подгружается список метрологов этой лаборатории во второй
`<select>`; кнопка "Направить на исполнение" остаётся задизейблена, пока не
выбраны оба значения (лаборатория и метролог — оба обязательны, не только
лаборатория как сегодня).

## Новые поля

Все — `null=True, blank=True`, без бэкфилла (существующий паттерн проекта:
ретрофит-поля не бэкфиллятся, а делаются nullable).

**`OrderItem`** (`device_type`/`model` остаются как есть — "Наименование СИ"
и "Тип/Модель СИ" соответственно, без переименования):
- `manufacturer_name` — CharField(max_length=255)
- `manufacturer_address` — CharField(max_length=255)
- `manufacturer_country` — CharField(max_length=255)
- `metrological_characteristics` — TextField

**`Order`** (по паттерну `payment_receipt`/`payment_receipt_name` — base64
`TextField` + `CharField` с именем файла):
- `power_of_attorney_file` / `power_of_attorney_file_name` — заполняет
  `client` на шаге 1
- `tech_documentation_file` / `tech_documentation_file_name` — заполняет
  `client` на шаге 1 (несколько файлов клиент упаковывает в один
  pdf/rar — отдельной модели вложений не заводим)
- `test_program_draft_file` / `test_program_draft_file_name` — заполняет
  `metrolog` на шаге 5
- `type_description_draft_file` / `type_description_draft_file_name` —
  заполняет `metrolog` на шаге 5
- `expertise_conclusion` — TextField, текст заключения от `metrolog`

`Order.metrologist` — поле уже существует (`models.py:33-36`), миграция не
нужна, меняется только то, что теперь его реально заполняет `assign_to_lab`.

Сериализаторы: новые поля добавляются в `OrderItemSerializer.Meta.fields`
(`serializers.py:8`) и `OrderSerializer.Meta.fields` (`serializers.py:14-19`).

**Обязательность на уровне формы, не БД**: на `CreateOrder.tsx` четыре новых
поля `OrderItem` (наименование производителя, адрес, страна,
метрологические характеристики) и два вложения (доверенность,
документация) — обязательные поля формы, по аналогии с уже обязательными
`deviceType`/`serialNumber`, несмотря на nullable в БД. Nullable в БД нужен
только для того, чтобы существующие заказы, созданные до этой миграции, не
ломались.

## Миграции

Одна миграция `backend/orders/migrations/000N_*.py`, генерируемая
`makemigrations orders` за один проход (по аналогии с уже существующей
`0002_...`, где были собраны несколько `AddField` + `AlterField` вместе):

- `AddField` × 4 на `OrderItem` (`manufacturer_name`, `manufacturer_address`,
  `manufacturer_country`, `metrological_characteristics`)
- `AddField` × 9 на `Order` (4 файловых пары × 2 + `expertise_conclusion`)
- `AlterField` на `Order.status` — расширение `choices` значением
  `expertise`

Данных-миграция (`RunPython`) не нужна: все новые поля nullable, `choices`
не имеет ограничения на уровне БД в Django/Postgres, существующие строки
остаются валидными без изменений.

## Новые/изменённые backend-эндпоинты — сводка

| Эндпоинт | Метод | Роль | Что делает |
|---|---|---|---|
| `orders/<id>/assign-lab/` | PUT | ~~director, gen_director~~ → **director** | *(изменение)* `gen_director` убран из разрешённых ролей; теперь требует `metrologist_id` наравне с `lab_id`; проверяет, что метролог активен, роли `metrolog`, принадлежит выбранной лаборатории |
| `orders/<id>/status/` | PUT | client, metrolog | *(изменение)* для роли metrolog — доп. проверка `order.metrologist_id == request.user.id` |
| `orders/` (GET) | GET | manager, metrolog | *(изменение)* для роли metrolog — игнорирует `labId`, фильтрует по `metrologist_id == request.user.id` |
| `orders/<id>/submit-expertise/` | PUT | metrolog | *(новый)* только из статуса `expertise`, только назначенный метролог; сохраняет 2 файла-драфта + `expertise_conclusion`; ставит `status = in_work` |
| `api/users/metrologists/<lab_id>/` | GET | director | *(новый)* список активных метрологов выбранной лаборатории |

`assign_to_lab` сужается до `director` симметрично `get_metrologists_by_lab`
— оба довода одинаковы: `gen_director` не участвует в этом процессе. Как
следствие, `GenDirector.tsx` теряет вкладку "Направить на исполнение" (см.
раздел "Назначение директором" выше и Frontend-сводку ниже).

## Frontend — сводка изменений по файлам

- **`GenDirector.tsx`** — вкладка "Направить на исполнение" удаляется
  целиком: состояние `activeTab`, `assignOrders`, `laboratories`,
  `selectedLabs`, `assigning`, функция `handleAssign`, кнопка-переключатель
  вкладки и весь JSX-блок `activeTab === 'assign'`; `fetchAll` перестаёт
  запрашивать `/orders/status/awaiting_delivery` и `laboratoryApi.getAll()`.
  Остаётся только "Финальное подписание" — единственная функция
  `gen_director` в этом процессе.
- **`Director.tsx`** — вкладка "assign": второй `<select>` для метролога,
  подгружаемый по выбранной лаборатории через
  `userApi.getMetrologistsByLab(labId)`; `handleAssign` передаёт оба id;
  кнопка недоступна, пока не выбраны оба значения.
- **`Queue.tsx`** — `fetchOrders`: убрать вычисление `labId` для роли
  metrolog, вызывать `orderApi.getAll()` без параметров (фильтрация теперь
  полностью на бэкенде); `statusFlow` — добавить `received_in_lab:
  'expertise'` и `expertise: 'in_work'`; `handleStatusChange` — если
  `currentStatus === 'expertise'`, открывать новую форму (2 файла + текст
  заключения) вместо обычной кнопки "Далее", по аналогии с уже
  существующей модалкой для `under_review → completed`; новый вызов
  `orderApi.submitExpertise(orderId, { testProgramDraft, typeDescriptionDraft,
  conclusion })`; добавить `expertise` в `statusLabels`/`statusColors`.
- **`CreateOrder.tsx`** — 4 новых обязательных текстовых поля в блоке
  "Информация о приборе" (наименование производителя, адрес, страна,
  метрологические характеристики) и 2 новых обязательных file-input
  (доверенность, документация: pdf/scan/jpeg/jpg/rar) с кодированием в
  base64 перед отправкой, по аналогии с существующим кодированием чека в
  `Orders.tsx`/`upload_receipt`.
- **`Orders.tsx`** — добавить `expertise` в `statusLabels`/`statusColors`;
  "Исх. №" в клиентском отображении — переиспользовать `order.orderNumber`
  под новой подписью, отдельную сквозную нумерацию не заводить.
- **`services/api.ts`** — `orderApi.assignLab` принимает `metrologistId`
  вторым параметром; новый `orderApi.submitExpertise(id, payload)`; новый
  `userApi.getMetrologistsByLab(labId)`.
- **`types/index.ts`** — `OrderStatus` получает `'expertise'`; `Order`
  получает новые файловые/текстовые поля; `OrderItem` получает 4 новых
  поля.
- **`ProtectedRoute.tsx` / `App.tsx`** — без изменений: роль `metrolog` уже
  промаршрутизирована на `/queue`, новых страниц не добавляется.

## Порядок реализации

Маленькими шагами с подтверждением на каждом — как и запрошено:

1. Backend: модели (`Order.Status`, `OrderItem`/`Order` новые поля) +
   миграция.
2. Backend: сериализаторы + вьюхи (`assign_to_lab` — сужение до `director`
   + обязательный `metrologist_id`, `update_order_status`, `orders_list`,
   `submit_expertise`, `get_metrologists_by_lab` + роут) +
   `orderApi`/`userApi` в `services/api.ts` + `types/index.ts`.
3. Frontend: `GenDirector.tsx` — удалить вкладку "Направить на исполнение"
   (иначе после шага 2 она начнёт падать с 403/400).
4. Frontend: `Director.tsx` — выбор метролога.
5. Frontend: `Queue.tsx` — фильтр видимости + обработка `expertise`.
6. Frontend: `CreateOrder.tsx` — новые поля и вложения.
7. Frontend: `Orders.tsx` — `statusLabels`/`statusColors`, "Исх. №".

## Открытые риски (не блокируют, но стоит держать в голове)

- Известная нестрогость `update_order_status` (см. раздел про
  статус-машину) — сознательно не расширяем текущую строгость проверки
  переходов за рамки того, что уже есть в коде.
- base64-в-`TextField` для документации/драфтов означает, что размер
  заявки в БД растёт с каждым вложением — как и сегодня для договора/чека;
  ограничение размера в view (по аналогии с 7MB/10MB) будет применено и к
  новым файловым полям.
