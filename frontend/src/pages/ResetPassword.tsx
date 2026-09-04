import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../services/api';
import Brand from '../components/Brand';

// Страница сброса пароля — открывается по ссылке из email
// URL содержит токен: /reset-password?token=UUID
export default function ResetPassword() {
  const navigate = useNavigate();

  // Извлекаем токен из URL параметра
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Валидация на фронтенде перед отправкой запроса
    if (password.length < 6) { setError('Пароль должен быть не менее 6 символов'); return; }
    if (password !== confirm) { setError('Пароли не совпадают'); return; }
    if (!token) { setError('Недействительная ссылка'); return; }

    try {
      setIsLoading(true);
      // Отправляем токен и новый пароль на бэкенд
      // Бэкенд проверит токен и обновит пароль через BCrypt
      await authApi.resetPassword({ token, newPassword: password });
      setSuccess('Пароль успешно изменён!');
      // Перенаправляем на страницу входа через 2 секунды
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при сбросе пароля');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all bg-white";

  return (
    <div className="min-h-screen bg-gray-50 flex" style={{ marginLeft: 0 }}>
      {/* Логотип в той же точке, что и в шапке приложения: полоса той же
          высоты, отступ от края окна — из brand-bar. На широком экране под
          логотипом тёмная панель, поэтому там вариант для тёмного фона. */}
      <div className="brand-bar fixed top-0 left-0 z-30">
        <Brand variant="onDark" className="hidden lg:flex" onClick={() => navigate('/')} />
        <Brand className="lg:hidden" onClick={() => navigate('/')} />
      </div>
      {/* Левая колонка */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0A2E5C 0%, #1E4A7C 50%, #0A2E5C 100%)' }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#00B2FF] rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#00B2FF] rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-end p-12 w-full">
          <div>
            <h2 className="text-4xl font-bold text-white mb-4" style={{ margin: '0 0 16px', fontSize: '2rem' }}>
              Цифровая метрология для вашего бизнеса
            </h2>
            <p className="text-white/70 text-lg leading-relaxed" style={{ margin: '0 0 40px' }}>
              Поверка, калибровка и испытания средств измерений — онлайн, без очередей и бумаг.
            </p>
            <div className="flex flex-col gap-4">
              {[
                'Электронные свидетельства и договоры',
                'Отслеживание статуса в реальном времени',
                'Проверенные аккредитованные лаборатории',
              ].map(item => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-[#00B2FF] rounded-full flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path d="m9 11 3 3L22 4" />
                    </svg>
                  </div>
                  <span className="text-white/80 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Правая колонка — форма */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 brand-bar-offset">
        <div className="w-full max-w-md">
          {/* Иконка ключа */}
          <div className="w-14 h-14 bg-[#00B2FF]/10 rounded-2xl flex items-center justify-center mb-6">
            <svg className="w-7 h-7 text-[#00B2FF]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-[#0A2E5C] mb-2" style={{ margin: '0 0 8px', fontSize: '1.75rem' }}>
            Новый пароль
          </h1>
          <p className="text-gray-500 text-sm mb-8" style={{ margin: '0 0 32px' }}>
            Придумайте надёжный пароль для вашего аккаунта
          </p>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-6 text-red-600 text-sm">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
              </svg>
              {error}
            </div>
          )}

          {success ? (
            // Состояние успеха — пароль изменён
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>
                </svg>
              </div>
              <p className="text-gray-700 font-medium mb-2" style={{ margin: '0 0 8px' }}>Пароль изменён!</p>
              <p className="text-gray-500 text-sm mb-6" style={{ margin: '0 0 24px' }}>
                Перенаправляем на страницу входа...
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 bg-[#00B2FF] hover:bg-[#0095D9] text-white font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors"
                style={{ marginBottom: 0 }}
              >
                Войти
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Новый пароль</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  required
                  className={inputClass}
                  style={{ fontFamily: 'inherit', marginBottom: 0 }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Подтвердите пароль</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Повторите пароль"
                  required
                  className={inputClass}
                  style={{ fontFamily: 'inherit', marginBottom: 0 }}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#00B2FF] hover:bg-[#0095D9] text-white font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors"
                style={{ marginBottom: 0 }}
              >
                {isLoading ? 'Сохранение...' : 'Сохранить пароль'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors"
                style={{ marginBottom: 0 }}
              >
                Вернуться к входу
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}