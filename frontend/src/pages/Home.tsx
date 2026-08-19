import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import { useAuthStore } from '../store/authStore';
import { serviceApi } from '../services/api';

interface Service {
  id: number;
  name: string;
  description: string;
  measurementType: string;
  price: number;
  durationDays: number;
  labName: string;
}

export default function Home() {
  const { isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [_services, setServices] = useState<Service[]>([]);
  const [results, setResults] = useState<Service[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const fuseRef = useRef<Fuse<Service> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Загружаем услуги один раз и инициализируем Fuse
  useEffect(() => {
    serviceApi.getAll().then(res => {
      const data = res.data;
      setServices(data);
      fuseRef.current = new Fuse(data, {
        keys: [
          { name: 'name', weight: 0.6 },
          { name: 'measurementType', weight: 0.3 },
          { name: 'description', weight: 0.1 },
        ],
        threshold: 0.4,      // 0.0 точное совпадение, 1.0 всё подряд
        includeScore: true,
        minMatchCharLength: 2,
      });
    }).catch(() => {});
  }, []);

  // Поиск при изменении запроса
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    if (fuseRef.current) {
      const found = fuseRef.current.search(query).slice(0, 6).map(r => r.item);
      setResults(found);
      setShowDropdown(true);
    }
  }, [query]);

  // Закрываем дропдаун при клике вне
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (_service: Service) => {
    setShowDropdown(false);
    setQuery('');
    navigate('/login'); // неавторизованный — на логин
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="home-page min-h-screen bg-white text-gray-900 font-sans" style={{ textAlign: 'left' }}>

      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-[#0A2E5C] to-[#00B2FF] rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <span className="text-xl font-bold text-[#0A2E5C]">MetrologyCatalog</span>
            </div>

            {/* Nav links */}
            <nav className="hidden md:flex items-center gap-8">
              <button 
                onClick={() => scrollTo('services')} 
                className="text-sm font-medium text-gray-600 hover:text-[#00B2FF] transition-colors bg-transparent border-none cursor-pointer p-0"
                style={{ background: 'none', padding: 0, marginBottom: 0, fontSize: '14px', fontWeight: 500 }}>
                Услуги
              </button>
              <button onClick={() => scrollTo('how-it-works')} 
                className="text-sm font-medium text-gray-600 hover:text-[#00B2FF] transition-colors bg-transparent border-none cursor-pointer p-0"
                style={{ background: 'none', padding: 0, marginBottom: 0, fontSize: '14px', fontWeight: 500 }}>
                Как это работает
              </button>
              <button onClick={() => scrollTo('benefits')} 
                className="text-sm font-medium text-gray-600 hover:text-[#00B2FF] transition-colors bg-transparent border-none cursor-pointer p-0"
                style={{ background: 'none', padding: 0, marginBottom: 0, fontSize: '14px', fontWeight: 500 }}>
                Преимущества
              </button>
            </nav>

            {/* Auth buttons */}
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <button
                    onClick={() => navigate('/profile')}
                    className="text-sm font-medium text-[#0A2E5C] hover:text-[#00B2FF] transition-colors bg-transparent border-none cursor-pointer px-4 py-2"
                    style={{ background: 'none', marginBottom: 0 }}
                  >
                    Профиль
                  </button>
                  <button
                    onClick={() => { logout(); navigate('/login'); }}
                    className="text-sm font-semibold bg-[#00B2FF] hover:bg-[#0095D9] text-white px-4 py-2 rounded-lg transition-colors border-none cursor-pointer"
                    style={{ marginBottom: 0 }}
                  >
                    Выйти
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => navigate('/login')}
                    className="text-sm font-medium text-[#0A2E5C] hover:text-[#00B2FF] transition-colors bg-transparent border-none cursor-pointer px-4 py-2"
                    style={{ background: 'none', marginBottom: 0 }}
                  >
                    Войти
                  </button>
                  <button
                    onClick={() => navigate('/register')}
                    className="text-sm font-semibold bg-[#00B2FF] hover:bg-[#0095D9] text-white px-4 py-2 rounded-lg transition-colors border-none cursor-pointer"
                    style={{ marginBottom: 0 }}
                  >
                    Регистрация
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-24 lg:pt-40 lg:pb-32 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0A2E5C 0%, #1E4A7C 50%, #0A2E5C 100%)' }}>
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#00B2FF] rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#00B2FF] rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full mb-6">
              <span className="text-xs font-semibold bg-[#00B2FF] text-white px-2 py-0.5 rounded-full">Новое</span>
              <span className="text-white/80 text-sm">Цифровая платформа метрологических услуг</span>
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight mb-6" style={{ margin: '0 0 24px', fontSize: 'clamp(36px, 5vw, 60px)', letterSpacing: '-1px' }}>
              Метрологические услуги <span className="text-[#00B2FF]">онлайн</span>
            </h1>
            <p className="text-lg text-white/80 mb-10 max-w-xl leading-relaxed" style={{ margin: '0 0 40px' }}>
              Поверка, калибровка и испытания средств измерений — быстро, прозрачно, без бумаг.
            </p>
            {/* Search */}
            <div className="relative w-full max-w-md" ref={dropdownRef}>
              <div className="relative flex gap-3">
                <div className="relative flex-1">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                    fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" />
                  </svg>
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => results.length > 0 && setShowDropdown(true)}
                    placeholder="Введите тип прибора..."
                    className="w-full pl-12 pr-4 py-4 bg-white text-gray-900 rounded-xl border-0 outline-none text-base placeholder:text-gray-400"
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <button
                  onClick={() => navigate('/register')}
                  className="px-6 py-4 bg-[#00B2FF] hover:bg-[#0095D9] text-white font-semibold rounded-xl border-none cursor-pointer text-base whitespace-nowrap flex items-center gap-2"
                  style={{ marginBottom: 0 }}
                >
                  Подать заявку
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>

              {/* Dropdown результаты */}
              {showDropdown && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl overflow-hidden z-50 border border-gray-100">
                  {results.map(service => (
                    <button
                      key={service.id}
                      onClick={() => handleSelect(service)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                      style={{ background: 'none', marginBottom: 0, borderRadius: 0, padding: '12px 16px' }}
                    >
                      <div className="font-medium text-gray-900 text-sm">{service.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{service.measurementType} · {service.durationDays} дн.</div>
                    </button>
                  ))}
                </div>
              )}

              {/* Нет результатов */}
              {showDropdown && query.length >= 2 && results.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl z-50 border border-gray-100">
                  <div className="px-4 py-3 text-sm text-gray-400">Ничего не найдено</div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-6 mt-8 text-white/70 text-sm">
              {['Электронный документооборот', 'Онлайн-оплата', 'Отслеживание статуса'].map(item => (
                <div key={item} className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#00B2FF] shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" />
                  </svg>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '50+', label: 'Услуг' },
              { value: '3', label: 'Лаборатории' },
              { value: '4', label: 'Филиала' },
              { value: '24ч', label: 'Средний срок' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-xl py-8 px-6 text-center shadow-sm hover:shadow-md transition-shadow">
                <div className="text-4xl font-bold text-[#0A2E5C]">{stat.value}</div>
                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#0A2E5C] mb-4" style={{ fontSize: '2rem', margin: '0 0 16px' }}>Каталог услуг</h2>
            <p className="text-gray-500 max-w-2xl mx-auto" style={{ margin: '0 auto' }}>
              Полный спектр метрологических услуг для вашего бизнеса в одном месте
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 isolate">
            {[
              {
                icon: (
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                ),
                title: 'Поверка средств измерений', desc: 'Государственная поверка приборов с выдачей свидетельства'
              },
              {
                icon: (
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>
                  </svg>
                ),
                title: 'Калибровка оборудования', desc: 'Точная настройка и калибровка измерительных приборов'
              },
              {
                icon: (
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>
                  </svg>
                ),
                title: 'Испытания в лаборатории', desc: 'Полный спектр лабораторных испытаний'
              },
              {
                icon: (
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>
                  </svg>
                ),
                title: 'Консультации', desc: 'Экспертные консультации по метрологии'
              },
              {
                icon: (
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="M3.29 7 12 12l8.71-5"/><path d="m7.5 4.27 9 5.15"/>
                  </svg>
                ),
                title: 'Аренда эталонов', desc: 'Временное использование эталонных средств измерений'
              },
              {
                icon: (
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>
                  </svg>
                ),
                title: 'Обучение', desc: 'Профессиональное обучение метрологии'
              },
            ].map(service => (
              <div key={service.title}
                className="group bg-white shadow-sm rounded-xl p-6 hover:shadow-lg transition-all duration-300 cursor-pointer">
                <div className="w-14 h-14 bg-gradient-to-br from-[#0A2E5C] to-[#1E4A7C] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {service.icon}
                </div>
                <h3 className="font-semibold text-[#0A2E5C] mb-2" style={{ margin: '0 0 8px', fontSize: '1rem' }}>{service.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed" style={{ margin: 0 }}>{service.desc}</p>
                <div className="mt-4 flex items-center text-[#00B2FF] text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Подробнее</span>
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#0A2E5C] mb-4" style={{ fontSize: '2rem', margin: '0 0 16px' }}>Как это работает</h2>
            <p className="text-gray-500" style={{ margin: 0 }}>Простой и прозрачный процесс от заявки до получения результата</p>
          </div>
          <div className="grid md:grid-cols-5 gap-8 relative">
            <div className="hidden md:block absolute top-8 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-transparent via-[#00B2FF] to-transparent" />
            {[
              { step: 1, icon: <svg className="w-8 h-8 text-[#00B2FF]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>, title: 'Выбор услуги', desc: 'Найдите нужную услугу в каталоге' },
              { step: 2, icon: <svg className="w-8 h-8 text-[#00B2FF]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>, title: 'Договор', desc: 'Автоматическое формирование и подписание' },
              { step: 3, icon: <svg className="w-8 h-8 text-[#00B2FF]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>, title: 'Оплата', desc: 'Онлайн-оплата' },
              { step: 4, icon: <svg className="w-8 h-8 text-[#00B2FF]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="M3.29 7 12 12l8.71-5"/><path d="m7.5 4.27 9 5.15"/></svg>, title: 'Сдача прибора', desc: 'Передача в ближайшую лабораторию' },
              { step: 5, icon: <svg className="w-8 h-8 text-[#00B2FF]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/></svg>, title: 'Результат', desc: 'Электронное свидетельство' },
            ].map(s => (
              <div key={s.step} className="relative text-center">
                <div className="w-16 h-16 mx-auto bg-white rounded-2xl shadow-lg flex items-center justify-center mb-4 relative z-10 border-2 border-[#00B2FF]">
                  {s.icon}
                </div>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-7 h-7 bg-[#00B2FF] rounded-full text-white text-xs font-bold flex items-center justify-center z-20">
                  {s.step}
                </div>
                <h3 className="font-semibold text-[#0A2E5C] mb-1" style={{ fontSize: '0.95rem', margin: '0 0 4px' }}>{s.title}</h3>
                <p className="text-gray-500 text-sm" style={{ margin: 0 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-[#0A2E5C] mb-4" style={{ fontSize: '2rem', margin: '0 0 16px' }}>Преимущества платформы</h2>
            <p className="text-gray-500" style={{ margin: 0 }}>Почему бизнес выбирает цифровые метрологические услуги</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 isolate">
            {[
              { icon: <svg className="w-6 h-6 text-[#00B2FF]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>, title: 'Без бумажной волокиты', desc: 'Все документы в электронном виде' },
              { icon: <svg className="w-6 h-6 text-[#00B2FF]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/></svg>, title: 'Прозрачные цены', desc: 'Чёткие сроки и стоимость услуг' },
              { icon: <svg className="w-6 h-6 text-[#00B2FF]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/></svg>, title: 'Онлайн-отслеживание', desc: 'Статус выполнения в реальном времени' },
              { icon: <svg className="w-6 h-6 text-[#00B2FF]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/></svg>, title: 'Электронные документы', desc: 'Свидетельства с электронной подписью' },
              { icon: <svg className="w-6 h-6 text-[#00B2FF]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/></svg>, title: 'Проверенные лаборатории', desc: '3 лаборатории и 4 филиала' },
              { icon: <svg className="w-6 h-6 text-[#00B2FF]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>, title: 'Государственные гарантии', desc: 'Официальный статус организации' },
            ].map(b => (
              <div key={b.title} className="relative z-0 hover:z-10 flex items-start gap-4 p-6 rounded-xl bg-white shadow-sm hover:shadow-md transition-all">
                <div className="w-12 h-12 bg-[#00B2FF]/10 rounded-lg flex items-center justify-center shrink-0">
                  {b.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-[#0A2E5C] mb-1" style={{ fontSize: '1rem', margin: '0 0 4px' }}>{b.title}</h3>
                  <p className="text-gray-500 text-sm" style={{ margin: 0 }}>{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20" style={{ background: 'linear-gradient(135deg, #0A2E5C 0%, #1E4A7C 100%)' }}>
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-white mb-6" style={{ fontSize: '2rem', margin: '0 0 24px' }}>Готовы начать?</h2>
          <p className="text-white/80 text-lg mb-8" style={{ margin: '0 0 32px' }}>
            Присоединяйтесь к компаниям, которые уже используют цифровые метрологические услуги
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/register')}
              className="px-8 py-4 bg-[#00B2FF] hover:bg-[#0095D9] text-white font-semibold rounded-xl border-none cursor-pointer text-base transition-colors flex items-center gap-2 justify-center"
            >
              Подать заявку
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 border border-white/40 text-white hover:bg-white/10 font-semibold rounded-xl bg-transparent cursor-pointer text-base transition-colors"
            >
              Личный кабинет
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0A2E5C] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-[#00B2FF] to-[#0095D9] rounded-lg flex items-center justify-center text-lg">⚙️</div>
                <span className="text-xl font-bold">MetrologyCatalog</span>
              </div>
              <p className="text-white/60 text-sm leading-relaxed" style={{ margin: 0 }}>
                Единая цифровая платформа метрологических услуг. Поверка, калибровка и испытания средств измерений онлайн.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4" style={{ margin: '0 0 16px', fontSize: '1rem' }}>Разделы</h4>
              <ul className="space-y-2 text-white/60 text-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {['Услуги', 'Как это работает', 'Преимущества'].map(link => (
                  <li key={link}>
                    <button
                      onClick={() => scrollTo(link === 'Услуги' ? 'services' : link === 'Как это работает' ? 'how-it-works' : 'benefits')}
                      className="text-white/60 hover:text-[#00B2FF] transition-colors bg-transparent border-none cursor-pointer text-sm p-0"
                    >
                      {link}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4" style={{ margin: '0 0 16px', fontSize: '1rem' }}>Контакты</h4>
              <ul className="space-y-2 text-white/60 text-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <li>📍 г. Астана</li>
                <li>🕐 Пн-Пт: 9:00 - 18:00</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 mt-12 pt-8 text-center text-white/40 text-sm">
            © 2026 MetrologyCatalog. Все права защищены.
          </div>
        </div>
      </footer>

    </div>
  );
}