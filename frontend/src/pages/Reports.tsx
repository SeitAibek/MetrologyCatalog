import { useState, useEffect } from 'react';
import { orderApi } from '../services/api';
import type { Order } from '../types';

// Страница отчётов для роли manager
// Показывает все заявки в системе с фильтрацией по статусу и подсчётом выручки
export default function Reports() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Словарь для перевода статусов на русский язык
  const statusLabels: Record<string, string> = {
    new: 'Новая',
    awaiting_payment: 'Ожидает оплаты',
    awaiting_delivery: 'Ожидает доставки',
    received_in_lab: 'Принято в лаб',
    in_work: 'В работе',
    under_review: 'На проверке',
    completed: 'Завершено',
  };

  // Цвета бейджей для каждого статуса
  const statusColors: Record<string, { bg: string; text: string }> = {
    new: { bg: 'bg-blue-100', text: 'text-blue-700' },
    awaiting_payment: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    awaiting_delivery: { bg: 'bg-amber-100', text: 'text-amber-700' },
    received_in_lab: { bg: 'bg-purple-100', text: 'text-purple-700' },
    in_work: { bg: 'bg-pink-100', text: 'text-pink-700' },
    under_review: { bg: 'bg-orange-100', text: 'text-orange-700' },
    completed: { bg: 'bg-green-100', text: 'text-green-700' },
  };

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const response = await orderApi.getAll();
      setOrders(response.data);
    } catch {
      setError('Ошибка при загрузке отчёта');
    } finally {
      setIsLoading(false);
    }
  };

  // Фильтруем заявки по выбранному статусу
  const filteredOrders = filterStatus ? orders.filter(o => o.status === filterStatus) : orders;

  // Считаем выручку только по завершённым заявкам из отфильтрованного списка
  const totalRevenue = filteredOrders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + (o.price ?? 0), 0);

  // Форматируем дату в читаемый вид для русской локали
  const formatDate = (dateString?: string) =>
    dateString ? new Date(dateString).toLocaleDateString('ru-RU') : '—';

  const getStatusClass = (status: string) =>
    statusColors[status] || { bg: 'bg-gray-100', text: 'text-gray-500' };

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-400">
        <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Загрузка...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1.75rem' }}>
            Отчёты
          </h1>
          <p className="text-gray-500 text-sm mt-1" style={{ margin: '4px 0 0' }}>
            Все заявки в системе с фильтрацией и статистикой выручки
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-6 text-red-600 text-sm">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
            </svg>
            {error}
          </div>
        )}

        {/* Панель фильтров и статистики */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all cursor-pointer"
            style={{ fontFamily: 'inherit', marginBottom: 0 }}
          >
            <option value="">Все статусы</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <div className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-100 rounded-xl shadow-sm text-sm">
            <span className="text-gray-400">Найдено:</span>
            <span className="font-bold text-[#0A2E5C]">{filteredOrders.length}</span>
          </div>

          {(filterStatus === 'completed' || filterStatus === '') && (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-100 rounded-xl shadow-sm text-sm">
              <span className="text-gray-400">Выручка:</span>
              <span className="font-bold text-green-600">{totalRevenue.toLocaleString()} ₸</span>
            </div>
          )}
        </div>

        {/* Таблица заявок */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="hidden md:grid grid-cols-5 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100">
            {['№ Заявки', 'Клиент ID', 'Статус', 'Стоимость', 'Срок'].map(col => (
              <div key={col} className="text-xs font-semibold text-[#00B2FF] uppercase tracking-wider">{col}</div>
            ))}
          </div>

          <div className="divide-y divide-gray-50">
            {filteredOrders.length === 0 ? (
              <div className="py-16 text-center text-gray-400">Нет заявок</div>
            ) : (
              filteredOrders.map(order => {
                const sc = getStatusClass(order.status);
                return (
                  <div key={order.id} className="grid grid-cols-1 md:grid-cols-5 gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors items-center">
                    <div className="font-bold text-[#0A2E5C]">#{order.orderNumber}</div>
                    <div className="text-sm text-gray-500">ID: {order.clientId}</div>
                    <div>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${sc.bg} ${sc.text}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-[#0A2E5C]">
                      {order.price != null ? `${order.price.toLocaleString()} ₸` : '—'}
                    </div>
                    <div className="text-sm text-gray-500">{formatDate(order.dueDate)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}