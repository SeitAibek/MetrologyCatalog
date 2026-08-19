import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { notificationApi } from '../services/api';
import type { Notification } from '../types';

const NOTIFICATION_ICONS: Record<string, string> = {
  order_status:      '📋',
  document_ready:    '📄',
  reminder:          '⏰',
  approval_required: '✅',
  payment_received:  '💳',
  assigned_to_lab:   '🏭',
  receipt_uploaded:  '🧾',
};

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const isMutatingRef = useRef(false);
  const lastReadAllRef = useRef<number>(0);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    if (!user) return;
    // Не перезаписываем состояние 10 секунд после markAllAsRead
    if (isMutatingRef.current || Date.now() - lastReadAllRef.current < 10_000) return;
    try {
      const res = await notificationApi.getAll(user.id);
      setNotifications((res.data as Notification[]).slice(0, 20));
    } catch {}
  };

  const handleMarkRead = async (notif: Notification) => {
    if (notif.isRead) return;
    try {
      isMutatingRef.current = true;
      await notificationApi.markAsRead(notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
    } catch {}
    finally { isMutatingRef.current = false; }
  };

  const handleMarkAllRead = async () => {
    if (!user || unreadCount === 0) return;
    // Сразу обновляем локально
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    lastReadAllRef.current = Date.now();
    try {
      await notificationApi.markAllAsRead(user.id);
    } catch {}
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const navigateTo = (path: string) => { navigate(path); setSidebarOpen(false); };
  const isActive = (path: string) => location.pathname === path;

  const navItemClass = (path: string) =>
    `w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer border-none flex items-center gap-3 ${
      isActive(path) ? 'bg-[#0A2E5C] text-white' : 'text-gray-600'
    }`;
  const navItemStyle = (path: string): React.CSSProperties =>
    isActive(path) ? { marginBottom: 0, background: '#0A2E5C' } : { marginBottom: 0, background: 'white' };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const diff = Date.now() - new Date(dateString).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'только что';
    if (min < 60) return `${min} мин назад`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} ч назад`;
    return `${Math.floor(h / 24)} д назад`;
  };

  return (
    <>
      <header className="bg-white border-b border-gray-100 px-4 h-[60px] flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <button className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 border-none cursor-pointer"
            style={{ marginBottom: 0, background: 'none' }} onClick={() => setSidebarOpen(!sidebarOpen)}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M4 5h16M4 12h16M4 19h16"/>
            </svg>
          </button>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigateTo('/')}>
            <div className="w-8 h-8 bg-gradient-to-br from-[#0A2E5C] to-[#00B2FF] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <span className="font-bold text-[#0A2E5C] text-lg hidden sm:block">MetrologyCatalog</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Колокольчик */}
          <div className="relative" ref={notifRef}>
            <button onClick={() => setNotifOpen(p => !p)}
              className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 border-none cursor-pointer transition-colors"
              style={{ marginBottom: 0, background: 'none' }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-[360px] bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#0A2E5C] text-sm">Уведомления</span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 font-semibold rounded-full">{unreadCount} новых</span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead}
                      className="text-xs text-[#00B2FF] hover:text-[#0095D9] border-none bg-transparent cursor-pointer font-medium"
                      style={{ marginBottom: 0 }}>
                      Прочитать все
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto max-h-[380px]">
                  {notifications.length === 0 ? (
                    <div className="py-12 text-center">
                      <svg className="w-10 h-10 mx-auto mb-3 text-gray-200" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                      </svg>
                      <p className="text-sm text-gray-400">Нет уведомлений</p>
                    </div>
                  ) : notifications.map(notif => (
                    <button key={notif.id}
                      onClick={() => {
                        handleMarkRead(notif);
                        // Переходим на страницу роли
                        if (['approver','director','financier'].includes(user?.role || '')) {
                          setNotifOpen(false);
                          navigateTo(
                          user?.role === 'approver' ? '/approver' :
                          user?.role === 'director' ? '/director' :
                          user?.role === 'financier' ? '/financier' :
                          user?.role === 'gen_director' ? '/gen-director' : '/approver'
                        );
                        } else if (notif.orderId) {
                          setNotifOpen(false);
                          navigateTo('/orders');
                        }
                      }}
                      className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors cursor-pointer border-none flex items-start gap-3 ${
                        notif.isRead ? 'bg-white hover:bg-gray-50' : 'bg-blue-50/60 hover:bg-blue-50'
                      }`}
                      style={{ marginBottom: 0 }}>
                      <span className="text-lg shrink-0 mt-0.5">{NOTIFICATION_ICONS[notif.notificationType] || '🔔'}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${notif.isRead ? 'text-gray-600' : 'text-gray-900 font-medium'}`} style={{ margin: 0 }}>
                          {notif.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1" style={{ margin: '4px 0 0' }}>
                          {formatTime(notif.readAt || undefined)}
                        </p>
                      </div>
                      {!notif.isRead && <div className="w-2 h-2 rounded-full bg-[#00B2FF] shrink-0 mt-1.5"/>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <div className="w-8 h-8 bg-[#00B2FF] rounded-full flex items-center justify-center text-white text-sm font-bold">
              {user?.fullName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-[#0A2E5C]" style={{ margin: 0 }}>{user?.fullName}</p>
              <p className="text-xs text-gray-400" style={{ margin: 0 }}>{user?.role}</p>
            </div>
          </div>

          <button onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg border-none cursor-pointer transition-colors"
            style={{ marginBottom: 0, background: 'none' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="hidden sm:block">Выход</span>
          </button>
        </div>
      </header>

      <aside className={`fixed left-0 top-[60px] h-[calc(100vh-60px)] w-[240px] bg-white border-r border-gray-100 z-40 transition-transform duration-300 overflow-y-auto
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <nav className="p-4 flex flex-col gap-1">

          <div className="flex items-center justify-between mb-4 md:hidden">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Меню</span>
            <button onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 border-none cursor-pointer"
              style={{ marginBottom: 0, background: 'none' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Общее */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2" style={{ margin: '0 0 8px' }}>Общее</p>
            <button onClick={() => navigateTo('/catalog')} className={navItemClass('/catalog')} style={navItemStyle('/catalog')}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/>
              </svg>
              Каталог услуг
            </button>
            <button onClick={() => navigateTo('/profile')} className={navItemClass('/profile')} style={navItemStyle('/profile')}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
              Профиль
            </button>
          </div>

          {/* Клиент */}
          {user?.role === 'client' && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2" style={{ margin: '0 0 8px' }}>Клиент</p>
              <button onClick={() => navigateTo('/create-order')} className={navItemClass('/create-order')} style={navItemStyle('/create-order')}>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
                </svg>
                Новая заявка
              </button>
              <button onClick={() => navigateTo('/orders')} className={navItemClass('/orders')} style={navItemStyle('/orders')}>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/>
                </svg>
                Мои заявки
              </button>
            </div>
          )}

          {/* Метролог */}
          {user?.role === 'metrolog' && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2" style={{ margin: '0 0 8px' }}>Работа</p>
              <button onClick={() => navigateTo('/queue')} className={navItemClass('/queue')} style={navItemStyle('/queue')}>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/>
                </svg>
                Очередь заявок
              </button>
            </div>
          )}

          {/* Менеджер */}
          {user?.role === 'manager' && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2" style={{ margin: '0 0 8px' }}>Управление</p>
              <button onClick={() => navigateTo('/orders')} className={navItemClass('/orders')} style={navItemStyle('/orders')}>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/>
                </svg>
                Все заявки
              </button>
              <button onClick={() => navigateTo('/create-order')} className={navItemClass('/create-order')} style={navItemStyle('/create-order')}>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
                </svg>
                Создать заявку
              </button>
              <button onClick={() => navigateTo('/dashboard')} className={navItemClass('/dashboard')} style={navItemStyle('/dashboard')}>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                </svg>
                Дашборд
              </button>
              <button onClick={() => navigateTo('/reports')} className={navItemClass('/reports')} style={navItemStyle('/reports')}>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>
                </svg>
                Отчёты
              </button>
            </div>
          )}

          {/* Согласующий, Директор, Финансист — единый пункт "Очередь" */}
          {['approver', 'director', 'financier', 'gen_director'].includes(user?.role || '') && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2" style={{ margin: '0 0 8px' }}>
                {user?.role === 'approver' ? 'Согласование' : user?.role === 'director' ? 'Руководство' : user?.role === 'gen_director' ? 'Ген.директор' : 'Финансы'}
              </p>
              <button onClick={() => navigateTo(
                  user?.role === 'gen_director' ? '/gen-director' :
                  user?.role === 'approver' ? '/approver' :
                  user?.role === 'director' ? '/director' :
                  user?.role === 'financier' ? '/financier' : '/approver'
                )} className={navItemClass(
                  user?.role === 'gen_director' ? '/gen-director' :
                  user?.role === 'approver' ? '/approver' :
                  user?.role === 'director' ? '/director' :
                  user?.role === 'financier' ? '/financier' : '/approver'
                )} style={navItemStyle(
                  user?.role === 'gen_director' ? '/gen-director' :
                  user?.role === 'approver' ? '/approver' :
                  user?.role === 'director' ? '/director' :
                  user?.role === 'financier' ? '/financier' : '/approver'
                )}>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                {user?.role === 'approver' && 'Согласование'}
                {user?.role === 'director' && 'Мой кабинет'}
                {user?.role === 'financier' && 'Мой кабинет'}
                {user?.role === 'gen_director' && 'Мой кабинет'}
                {unreadCount > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 text-[10px] bg-red-100 text-red-600 font-semibold rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Администратор */}
          {user?.role === 'admin' && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2" style={{ margin: '0 0 8px' }}>Администрирование</p>
              <button onClick={() => navigateTo('/admin/users')} className={navItemClass('/admin/users')} style={navItemStyle('/admin/users')}>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Пользователи
              </button>
            </div>
          )}

        </nav>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)}/>
      )}
    </>
  );
}