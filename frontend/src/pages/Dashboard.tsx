import { useState, useEffect } from 'react';
import api from '../services/api';

// Интерфейс для данных статистики получаемых с бэкенда
interface Stats {
  totalOrders: number;
  completedOrders: number;
  inWorkOrders: number;
  newOrders: number;
  awaitingPayment: number;
  totalRevenue: number;
  totalClients: number;
}

// Страница дашборда для роли manager
// Показывает агрегированную статистику по всем заявкам и пользователям
export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      // GET /api/stats — данные считаются на бэкенде через Stream API
      const response = await api.get('/stats');
      setStats(response.data);
    } catch {
      setError('Ошибка при загрузке статистики');
    } finally {
      setIsLoading(false);
    }
  };

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

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-red-500">{error}</div>
    </div>
  );

  if (!stats) return null;

  // Карточки статистики — конфигурация
  const statCards = [
    { label: 'Всего заявок', value: stats.totalOrders, icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Завершено', value: stats.completedOrders, icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/></svg>, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'В работе', value: stats.inWorkOrders, icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>, color: 'text-pink-600', bg: 'bg-pink-50' },
    { label: 'Новые', value: stats.newOrders, icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Ожидают оплаты', value: stats.awaitingPayment, icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Клиентов', value: stats.totalClients, icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1.75rem' }}>
            Дашборд
          </h1>
          <p className="text-gray-500 text-sm mt-1" style={{ margin: '4px 0 0' }}>
            Агрегированная статистика по всем заявкам и пользователям
          </p>
        </div>

        {/* Сетка карточек со статистикой */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 mb-8">
          {statCards.map(card => (
            <div key={card.label} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-12 h-12 ${card.bg} ${card.color} rounded-xl flex items-center justify-center mb-4`}>
                {card.icon}
              </div>
              <p className="text-sm text-gray-400 mb-1" style={{ margin: '0 0 4px' }}>{card.label}</p>
              <p className={`text-3xl font-bold ${card.color}`} style={{ margin: 0 }}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Карточка выручки — широкая */}
        <div className="bg-gradient-to-br from-[#0A2E5C] to-[#1E4A7C] rounded-2xl p-8 text-white shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#00B2FF]/20 rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7 text-[#00B2FF]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
            <div>
              <p className="text-white/60 text-sm" style={{ margin: '0 0 4px' }}>Суммарная выручка</p>
              <p className="text-4xl font-bold text-white" style={{ margin: 0 }}>
                {stats.totalRevenue.toLocaleString()} ₸
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}