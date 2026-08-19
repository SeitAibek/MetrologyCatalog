import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface NotFoundProps {
  code?: number; // 404 по умолчанию, передаётся 403 для страницы запрета доступа
}

// Универсальная страница ошибок — используется для 403 и 404
// 403 — нет доступа (неправильная роль)
// 404 — страница не найдена
export default function NotFound({ code = 404 }: NotFoundProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Перенаправляет пользователя на главную страницу его роли
  const goHome = () => {
    if (!user) { navigate('/login'); return; }
    switch (user.role) {
      case 'client':   navigate('/catalog'); break;
      case 'metrolog': navigate('/queue'); break;
      case 'manager':  navigate('/queue'); break;
      case 'admin':    navigate('/catalog'); break;
      default:         navigate('/login');
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '100px' }}>
      <h1>{code}</h1>
      <p>{code === 403 ? 'У вас нет доступа к этой странице.' : 'Страница не найдена.'}</p>
      <button
        onClick={goHome}
        style={{
          display: 'inline-block',
          marginTop: '16px',
          padding: '10px 24px',
          fontSize: '16px',
          cursor: 'pointer',
          borderRadius: '6px',
          border: 'none',
          backgroundColor: '#3b82f6',
          color: 'white',
        }}
      >
        Вернуться на главную
      </button>
    </div>
  );
}