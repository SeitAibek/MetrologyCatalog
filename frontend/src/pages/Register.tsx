import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../services/api';

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [formData, setFormData] = useState({
    idNumber: '',
    email: '',
    password: '',
    fullName: '',
    phone: '',
    bin: '',
    companyName: '',
    companyAddress: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'idNumber' || name === 'bin') {
      setFormData(prev => ({ ...prev, [name]: value.replace(/\D/g, '').slice(0, 12) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.idNumber.length !== 12) {
      setError('ИИН должен содержать ровно 12 цифр');
      return;
    }
    if (formData.bin.length !== 12) {
      setError('БИН должен содержать ровно 12 цифр');
      return;
    }
    if (formData.password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.register({
        idNumber: formData.idNumber,
        email: formData.email || undefined,
        password: formData.password,
        fullName: formData.fullName,
        phone: formData.phone,
        bin: formData.bin,
        companyName: formData.companyName,
        companyAddress: formData.companyAddress,
      });
      const { token, user } = response.data;
      login(user, token);
      navigate('/orders');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка регистрации');
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

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md py-8">
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
            Регистрация
          </h1>
          <p className="text-gray-500 text-sm mb-8" style={{ margin: '0 0 32px' }}>
            Уже есть аккаунт?{' '}
            <span className="text-[#00B2FF] cursor-pointer hover:underline font-medium"
              onClick={() => navigate('/login')}>
              Войдите
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

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">

            <div>
              <p className="text-xs font-semibold text-[#00B2FF] uppercase tracking-wider mb-3" style={{ margin: '0 0 12px' }}>
                Личные данные
              </p>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ИИН *</label>
                  <input type="text" name="idNumber" value={formData.idNumber} onChange={handleChange}
                    required placeholder="123456789012" maxLength={12}
                    className={inputClass} style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                  <p className="text-xs text-gray-400 mt-1" style={{ margin: '4px 0 0' }}>
                    Используется для входа в систему
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Пароль *</label>
                  <input type="password" name="password" value={formData.password} onChange={handleChange}
                    required placeholder="Минимум 6 символов"
                    className={inputClass} style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">ФИО *</label>
                  <input type="text" name="fullName" value={formData.fullName} onChange={handleChange}
                    required placeholder="Иванов Иван Иванович"
                    className={inputClass} style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Телефон *</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                    required placeholder="+7 (777) 123-45-67"
                    className={inputClass} style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email <span className="text-gray-400 font-normal">(для уведомлений)</span>
                  </label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange}
                    placeholder="your@email.com"
                    className={inputClass} style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#00B2FF] uppercase tracking-wider mb-3" style={{ margin: '0 0 12px' }}>
                Данные компании
              </p>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">БИН компании *</label>
                  <input type="text" name="bin" value={formData.bin} onChange={handleChange}
                    required placeholder="123456789012" maxLength={12}
                    className={inputClass} style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Название компании *</label>
                  <input type="text" name="companyName" value={formData.companyName} onChange={handleChange}
                    required placeholder="ТОО Моя компания"
                    className={inputClass} style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Адрес компании *</label>
                  <input type="text" name="companyAddress" value={formData.companyAddress} onChange={handleChange}
                    required placeholder="г. Астана, ул. Абая 1"
                    className={inputClass} style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#00B2FF] hover:bg-[#0095D9] disabled:bg-gray-300 text-white font-semibold rounded-xl transition-colors border-none cursor-pointer text-sm"
              style={{ marginBottom: 0 }}
            >
              {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}