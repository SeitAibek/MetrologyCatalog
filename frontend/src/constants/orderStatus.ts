import type { OrderStatus } from '../types';

// 12 статусов, где текст сходится дословно во всех трёх экранах, использующих
// статус-карты (Orders.tsx, Queue.tsx, Reports.tsx). pending_delivery и
// awaiting_delivery сюда не входят — см. TODO ниже.
const BASE_STATUS_LABELS = {
  pending_contract:  'Ожидает договора',
  revision:          'На доработке',
  awaiting_approval: 'На согласовании',
  awaiting_payment:  'Ожидает оплаты',
  received_in_lab:   'Принято в лаб',
  expertise:         'Экспертиза документации',
  in_work:           'В работе',
  under_review:      'На проверке',
  completed:         'Завершено',
  cancelled:         'Отменено',
  annulled:          'Аннулировано',
  terminated:        'Расторгнуто',
} as const;

// TODO(pending_delivery/awaiting_delivery): формулировки расходятся по всем
// трём экранам и требуют решения заказчика, не унифицированы намеренно.
// Reports.tsx называет pending_delivery «Ожидает направления», а Orders.tsx/
// Queue.tsx — «Оплата получена»; при этом Queue.tsx использует «Ожидает
// направления» для СЛЕДУЮЩЕГО статуса awaiting_delivery — похоже на
// формулировку, съехавшую на соседний статус при копировании. Когда решение
// придёт, перенести обе строки в BASE_STATUS_LABELS и удалить
// ORDER_STATUS_LABELS_QUEUE/_REPORTS — останется один экспорт.

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  ...BASE_STATUS_LABELS,
  pending_delivery:  'Оплата получена',
  awaiting_delivery: 'Ожидает доставки',
};

export const ORDER_STATUS_LABELS_QUEUE: Record<OrderStatus, string> = {
  ...BASE_STATUS_LABELS,
  pending_delivery:  'Оплата получена',
  awaiting_delivery: 'Ожидает направления',
};

export const ORDER_STATUS_LABELS_REPORTS: Record<OrderStatus, string> = {
  ...BASE_STATUS_LABELS,
  pending_delivery:  'Ожидает направления',
  awaiting_delivery: 'Ожидает доставки',
};

// Основная палитра — Orders.tsx и Queue.tsx (их цвета совпадают дословно
// по всем статусам, включая expertise после унификации на indigo).
export const ORDER_STATUS_COLORS: Record<OrderStatus, { bg: string; text: string }> = {
  pending_contract:  { bg: 'bg-slate-100',  text: 'text-slate-600' },
  revision:          { bg: 'bg-orange-100', text: 'text-orange-700' },
  awaiting_approval: { bg: 'bg-blue-100',   text: 'text-blue-700' },
  awaiting_payment:  { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  pending_delivery:  { bg: 'bg-lime-100',   text: 'text-lime-700' },
  awaiting_delivery: { bg: 'bg-amber-100',  text: 'text-amber-700' },
  received_in_lab:   { bg: 'bg-purple-100', text: 'text-purple-700' },
  expertise:         { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  in_work:           { bg: 'bg-pink-100',   text: 'text-pink-700' },
  under_review:      { bg: 'bg-orange-100', text: 'text-orange-700' },
  completed:         { bg: 'bg-green-100',  text: 'text-green-700' },
  cancelled:         { bg: 'bg-gray-100',   text: 'text-gray-500' },
  annulled:          { bg: 'bg-red-100',    text: 'text-red-600' },
  terminated:        { bg: 'bg-red-100',    text: 'text-red-600' },
};

// Приглушённая палитра — Reports.tsx: осознанно единый нейтральный серый для
// cancelled/annulled/terminated (не отвлекать цветом в табличном отчёте).
export const ORDER_STATUS_COLORS_MUTED: Record<OrderStatus, { bg: string; text: string }> = {
  pending_contract:  { bg: 'bg-blue-100',   text: 'text-blue-700' },
  revision:          { bg: 'bg-red-100',    text: 'text-red-700' },
  awaiting_approval: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  awaiting_payment:  { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  pending_delivery:  { bg: 'bg-lime-100',   text: 'text-lime-700' },
  awaiting_delivery: { bg: 'bg-amber-100',  text: 'text-amber-700' },
  received_in_lab:   { bg: 'bg-purple-100', text: 'text-purple-700' },
  expertise:         { bg: 'bg-cyan-100',   text: 'text-cyan-700' },
  in_work:           { bg: 'bg-pink-100',   text: 'text-pink-700' },
  under_review:      { bg: 'bg-orange-100', text: 'text-orange-700' },
  completed:         { bg: 'bg-green-100',  text: 'text-green-700' },
  cancelled:         { bg: 'bg-gray-200',   text: 'text-gray-600' },
  annulled:          { bg: 'bg-gray-200',   text: 'text-gray-600' },
  terminated:        { bg: 'bg-gray-200',   text: 'text-gray-600' },
};
