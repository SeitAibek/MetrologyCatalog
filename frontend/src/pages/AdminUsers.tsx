import { useState, useEffect } from 'react';
import api from '../services/api';

// Интерфейс пользователя для страницы администрирования
interface User {
  id: number;
  email: string;
  fullName: string;
  role: string;
  phone: string;
  active: boolean;
}

// Страница управления пользователями для роли admin
// Позволяет менять роли и блокировать/активировать аккаунты
export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Словарь для перевода ролей на русский язык
  const roleLabels: Record<string, string> = {
    client: 'Клиент',
    metrolog: 'Метролог',
    manager: 'Руководитель',
    admin: 'Администратор',
  };

  // Цвета бейджей для каждой роли
  const roleColors: Record<string, { bg: string; text: string }> = {
    client: { bg: 'bg-blue-100', text: 'text-blue-700' },
    metrolog: { bg: 'bg-purple-100', text: 'text-purple-700' },
    manager: { bg: 'bg-orange-100', text: 'text-orange-700' },
    admin: { bg: 'bg-red-100', text: 'text-red-700' },
  };

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      // GET /api/users — доступен только администратору
      const response = await api.get('/users');
      setUsers(response.data);
    } catch {
      setError('Ошибка при загрузке пользователей');
    } finally {
      setIsLoading(false);
    }
  };

  // Меняет роль пользователя через выпадающий список
  // Обновляет данные локально без перезагрузки страницы
  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await api.put(`/users/${userId}/role`, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch {
      setError('Ошибка при смене роли');
    }
  };

  // Переключает статус активности пользователя (блокировка/разблокировка)
  const handleToggleActive = async (userId: number, isActive: boolean) => {
    try {
      // Передаём инвертированное значение — меняем на противоположное
      await api.put(`/users/${userId}/active`, { active: !isActive });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, active: !isActive } : u));
    } catch {
      setError('Ошибка при изменении статуса пользователя');
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1.75rem' }}>
            Управление пользователями
          </h1>
          <p className="text-gray-500 text-sm mt-1" style={{ margin: '4px 0 0' }}>
            Всего пользователей: <span className="font-semibold text-[#0A2E5C]">{users.length}</span>
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

        {/* Таблица пользователей */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="hidden lg:grid grid-cols-[60px_1fr_1fr_120px_140px_120px_140px] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100">
            {['ID', 'ФИО', 'Email', 'Телефон', 'Роль', 'Статус', 'Действия'].map(col => (
              <div key={col} className="text-xs font-semibold text-[#00B2FF] uppercase tracking-wider">{col}</div>
            ))}
          </div>

          <div className="divide-y divide-gray-50">
            {users.map(user => {
              const rc = roleColors[user.role] || { bg: 'bg-gray-100', text: 'text-gray-600' };
              return (
                // Заблокированные пользователи отображаются полупрозрачными
                <div key={user.id}
                  className={`grid grid-cols-1 lg:grid-cols-[60px_1fr_1fr_120px_140px_120px_140px] gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors items-center ${!user.active ? 'opacity-50' : ''}`}>

                  <div className="text-xs text-gray-400 font-mono">#{user.id}</div>
                  <div className="font-medium text-[#0A2E5C] text-sm">{user.fullName || '—'}</div>
                  <div className="text-sm text-gray-500 truncate">{user.email}</div>
                  <div className="text-sm text-gray-500">{user.phone || '—'}</div>

                  {/* Выпадающий список для смены роли */}
                  <div>
                    <select
                      value={user.role}
                      onChange={e => handleRoleChange(user.id, e.target.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-none outline-none cursor-pointer ${rc.bg} ${rc.text}`}
                      style={{ fontFamily: 'inherit', marginBottom: 0 }}
                    >
                      {Object.entries(roleLabels).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Бейдж статуса активности */}
                  <div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${user.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {user.active ? 'Активен' : 'Заблокирован'}
                    </span>
                  </div>

                  {/* Кнопка блокировки/активации */}
                  <div>
                    <button
                      onClick={() => handleToggleActive(user.id, user.active)}
                      className={`px-3 py-1.5 text-white font-medium rounded-lg border-none cursor-pointer text-xs transition-colors ${user.active ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}
                      style={{ marginBottom: 0 }}
                    >
                      {user.active ? 'Заблокировать' : 'Активировать'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}