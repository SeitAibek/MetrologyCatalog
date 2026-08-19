import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../services/api';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [idNumber, setIdNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!idNumber || !password) {
      setError('Введите ИИН и пароль');
      return;
    }
    if (idNumber.length !== 12 || !/^\d{12}$/.test(idNumber)) {
      setError('ИИН должен содержать ровно 12 цифр');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.login({ idNumber, password });
      const { token, user } = response.data;
      login(user, token);

      const roleRoutes: Record<string, string> = {
        client: '/orders',
        manager: '/orders',
        metrolog: '/queue',
        director: '/director',
        gen_director: '/gen-director',
        financier: '/financier',
        approver: '/approver',
        admin: '/admin/users',
      };
      navigate(roleRoutes[user.role] || '/profile');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm bg-white outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all";

  return (
    <div className="min-h-screen bg-gray-50 flex" style={{ marginLeft: 0 }}>
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0A2E5C 0%, #1E4A7C 50%, #0A2E5C 100%)' }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#00B2FF] rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#00B2FF] rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <span className="text-white font-bold text-xl">MetrologyCatalog</span>
          </div>
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
          <p className="text-white/40 text-sm">© 2026 MetrologyCatalog</p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 lg:hidden cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 bg-gradient-to-br from-[#0A2E5C] to-[#00B2FF] rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <span className="text-xl font-bold text-[#0A2E5C]">MetrologyCatalog</span>
          </div>

          <h1 className="text-2xl font-bold text-[#0A2E5C] mb-2" style={{ margin: '0 0 8px', fontSize: '1.75rem' }}>
            Вход в систему
          </h1>
          <p className="text-gray-500 text-sm mb-8" style={{ margin: '0 0 32px' }}>
            Нет аккаунта?{' '}
            <span className="text-[#00B2FF] cursor-pointer hover:underline font-medium"
              onClick={() => navigate('/register')}>
              Зарегистрироваться
            </span>
          </p>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-6 text-red-600 text-sm">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ИИН *</label>
              <input
                type="text"
                value={idNumber}
                onChange={e => setIdNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                required
                placeholder="123456789012"
                maxLength={12}
                className={inputClass}
                style={{ fontFamily: 'inherit', marginBottom: 0 }}
              />
              <p className="text-xs text-gray-400 mt-1" style={{ margin: '4px 0 0' }}>
                12-значный идентификационный номер
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Пароль *</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Ваш пароль"
                className={inputClass}
                style={{ fontFamily: 'inherit', marginBottom: 0 }}
              />
            </div>

            <div className="flex justify-end">
              <span className="text-sm text-[#00B2FF] cursor-pointer hover:underline"
                onClick={() => navigate('/forgot-password')}>
                Забыли пароль?
              </span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#00B2FF] hover:bg-[#0095D9] disabled:bg-gray-300 text-white font-semibold rounded-xl transition-colors border-none cursor-pointer text-sm"
              style={{ marginBottom: 0 }}
            >
              {isLoading ? 'Вход...' : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}