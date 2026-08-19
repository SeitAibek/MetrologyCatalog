import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { userApi } from '../services/api';
import type { Company } from '../types';

export default function Profile() {
  const { user, logout } = useAuthStore();
  const [company, setCompany] = useState<Company | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const [companyForm, setCompanyForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    if (user?.id) fetchProfile();
  }, [user?.id]);

  const fetchProfile = async () => {
    try {
      const res = await userApi.getProfile(user!.id);
      if (res.data.company) {
        const c = res.data.company;
        setCompany(c);
        setCompanyForm({
          name: c.name || '',
          address: c.address || '',
          phone: c.phone || '',
          email: c.email || '',
        });
      }
    } catch {}
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCompanyForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!formData.fullName) {
      setError('ФИО обязательно');
      return;
    }
    try {
      setIsSaving(true);
      await userApi.updateProfile({
        id: user?.id,
        fullName: formData.fullName,
        email: formData.email || null,
        phone: formData.phone || null,
        company: user?.companyId ? companyForm : null,
      });
      setSuccess('Профиль обновлён');
      setIsEditing(false);
      fetchProfile();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при обновлении');
    } finally {
      setIsSaving(false);
    }
  };

  const roleLabels: Record<string, string> = {
    client: 'Клиент',
    metrolog: 'Метролог',
    manager: 'Менеджер',
    director: 'Руководитель',
    gen_director: 'Ген. директор',
    financier: 'Финансист',
    approver: 'Согласующий',
    admin: 'Администратор',
  };

  const inputClass = "w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm bg-white outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all";

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1.75rem' }}>
            Мой профиль
          </h1>
          <p className="text-gray-500 text-sm mt-1" style={{ margin: '4px 0 0' }}>
            Личные данные и реквизиты компании
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
        {success && (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl mb-6 text-green-600 text-sm">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>
            </svg>
            {success}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          <div className="px-8 py-6 border-b border-gray-100"
            style={{ background: 'linear-gradient(135deg, #0A2E5C 0%, #1E4A7C 100%)' }}>
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 bg-[#00B2FF] rounded-2xl flex items-center justify-center text-white text-2xl font-bold shrink-0">
                {user?.fullName?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white" style={{ margin: '0 0 6px', fontSize: '1.25rem' }}>
                  {user?.fullName}
                </h2>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white/20 text-white">
                  {roleLabels[user?.role || 'client']}
                </span>
              </div>
              <div className="ml-auto text-right">
                <p className="text-white/40 text-xs" style={{ margin: 0 }}>ИИН</p>
                <p className="text-white/70 text-sm font-mono" style={{ margin: '2px 0 0' }}>
                  {user?.idNumber || '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="px-8 py-6">
            {!isEditing ? (
              <>
                <div className="mb-6">
                  <p className="text-xs font-semibold text-[#00B2FF] uppercase tracking-wider mb-4" style={{ margin: '0 0 16px' }}>
                    Личные данные
                  </p>
                  <div className="flex flex-col gap-0">
                    {[
                      { label: 'ФИО', value: user?.fullName },
                      { label: 'Телефон', value: user?.phone || '—' },
                      { label: 'Email', value: user?.email || '—' },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between items-center py-3 border-b border-gray-50">
                        <span className="text-sm text-gray-400">{item.label}</span>
                        <span className="text-sm font-medium text-gray-800">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {company && (
                  <div className="mb-8">
                    <p className="text-xs font-semibold text-[#00B2FF] uppercase tracking-wider mb-4" style={{ margin: '0 0 16px' }}>
                      Данные компании
                    </p>
                    <div className="flex flex-col gap-0">
                      {[
                        { label: 'БИН', value: company.bin },
                        { label: 'Название', value: company.name },
                        { label: 'Адрес', value: company.address || '—' },
                        { label: 'Телефон', value: company.phone || '—' },
                        { label: 'Email', value: company.email || '—' },
                      ].map(item => (
                        <div key={item.label} className="flex justify-between items-center py-3 border-b border-gray-50">
                          <span className="text-sm text-gray-400">{item.label}</span>
                          <span className="text-sm font-medium text-gray-800">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setIsEditing(true)}
                    className="flex-1 py-3 bg-[#00B2FF] hover:bg-[#0095D9] text-white font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors flex items-center justify-center gap-2"
                    style={{ marginBottom: 0 }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Редактировать
                  </button>
                  <button onClick={() => { logout(); window.location.href = '/login'; }}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors flex items-center justify-center gap-2"
                    style={{ marginBottom: 0 }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Выйти
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSave} className="flex flex-col gap-5">

                <div>
                  <p className="text-xs font-semibold text-[#00B2FF] uppercase tracking-wider mb-4" style={{ margin: '0 0 16px' }}>
                    Личные данные
                  </p>
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">ФИО *</label>
                      <input type="text" name="fullName" value={formData.fullName} onChange={handleChange}
                        required className={inputClass} style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Телефон</label>
                      <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                        placeholder="+7 (777) 123-45-67" className={inputClass}
                        style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Email <span className="text-gray-400 font-normal">(для уведомлений)</span>
                      </label>
                      <input type="email" name="email" value={formData.email} onChange={handleChange}
                        placeholder="your@email.com" className={inputClass}
                        style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                    </div>
                  </div>
                </div>

                {company && (
                  <div>
                    <p className="text-xs font-semibold text-[#00B2FF] uppercase tracking-wider mb-4" style={{ margin: '0 0 16px' }}>
                      Данные компании
                    </p>
                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          БИН <span className="text-gray-400 font-normal">(не изменяется)</span>
                        </label>
                        <input type="text" value={company.bin} disabled
                          className="w-full px-4 py-3 border border-gray-100 rounded-xl text-gray-400 text-sm bg-gray-50 cursor-not-allowed"
                          style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Название компании *</label>
                        <input type="text" name="name" value={companyForm.name} onChange={handleCompanyChange}
                          required className={inputClass} style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Адрес *</label>
                        <input type="text" name="address" value={companyForm.address} onChange={handleCompanyChange}
                          required className={inputClass} style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Телефон компании</label>
                        <input type="tel" name="phone" value={companyForm.phone} onChange={handleCompanyChange}
                          placeholder="+7 (777) 123-45-67" className={inputClass}
                          style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email компании</label>
                        <input type="email" name="email" value={companyForm.email} onChange={handleCompanyChange}
                          placeholder="company@email.com" className={inputClass}
                          style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-2">
                  <button type="submit" disabled={isSaving}
                    className="flex-1 py-3 bg-[#00B2FF] hover:bg-[#0095D9] disabled:bg-gray-300 text-white font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors"
                    style={{ marginBottom: 0 }}>
                    {isSaving ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button type="button" disabled={isSaving}
                    onClick={() => {
                      setIsEditing(false);
                      setFormData({ fullName: user?.fullName || '', email: user?.email || '', phone: user?.phone || '' });
                      if (company) setCompanyForm({ name: company.name, address: company.address || '', phone: company.phone || '', email: company.email || '' });
                    }}
                    className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors"
                    style={{ marginBottom: 0 }}>
                    Отменить
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}