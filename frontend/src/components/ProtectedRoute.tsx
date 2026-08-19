import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string[]; // Если не указаны — доступно всем авторизованным
}

// Компонент защиты маршрутов (RBAC — Role Based Access Control)
// Оборачивает страницы которые требуют авторизации или определённой роли
export const ProtectedRoute = ({ children, requiredRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, user, loadFromStorage } = useAuthStore();

  // Состояние загрузки — нужно чтобы успеть загрузить данные из localStorage
  // до того как компонент решит куда перенаправить пользователя
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Восстанавливаем сессию из localStorage при обновлении страницы
    loadFromStorage();
    setIsLoading(false);
  }, []);

  // Показываем заглушку пока данные загружаются из localStorage
  if (isLoading) {
    return <div>Загрузка...</div>;
  }

  // Если пользователь не авторизован — перенаправляем на страницу входа
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Если маршрут требует определённую роль — проверяем соответствие
  // Если роль не подходит — перенаправляем на страницу 403
  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  // Пользователь авторизован и имеет нужную роль — показываем страницу
  return <>{children}</>;
};