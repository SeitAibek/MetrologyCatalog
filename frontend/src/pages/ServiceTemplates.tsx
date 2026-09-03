import { useState, useEffect } from 'react';
import { serviceApi } from '../services/api';
import type { Service, CustomFieldDef, CustomFieldType, CustomFieldScope } from '../types';

const TYPE_OPTIONS: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Текст' },
  { value: 'textarea', label: 'Многострочный текст' },
  { value: 'number', label: 'Число' },
  { value: 'date', label: 'Дата' },
  { value: 'select', label: 'Список (выбор)' },
];

const SCOPE_OPTIONS: { value: CustomFieldScope; label: string }[] = [
  { value: 'item', label: 'Прибор (на каждую позицию)' },
  { value: 'order', label: 'Заявка (общее)' },
];

const EMPTY_FIELD: CustomFieldDef = { key: '', label: '', type: 'text', required: false, scope: 'item' };

// Та же проверка, что и на бэкенде (update_service_template) - показываем
// ошибку сразу, не дожидаясь round-trip, но финальное слово всё равно за
// сервером (см. catch в handleSave).
function validateSchema(schema: CustomFieldDef[]): string | null {
  const seenKeys = new Set<string>();
  for (const field of schema) {
    const key = field.key.trim();
    if (!key) return 'У каждого поля должен быть непустой key';
    if (seenKeys.has(key)) return `Ключ «${key}» повторяется в схеме`;
    seenKeys.add(key);
    if (!field.label.trim()) return `У поля «${key}» должен быть заполнен label`;
    if (field.type === 'select' && (!field.options || field.options.length === 0)) {
      return `У поля-списка «${key}» должны быть варианты выбора`;
    }
  }
  return null;
}

export default function ServiceTemplates() {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);
  const [schemaDraft, setSchemaDraft] = useState<CustomFieldDef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { fetchServices(); }, []);

  const fetchServices = async () => {
    try {
      setIsLoading(true);
      const res = await serviceApi.getAll();
      setServices(res.data);
    } catch {
      setError('Ошибка при загрузке услуг');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectService = (id: number) => {
    const service = services.find(s => s.id === id);
    setSelectedServiceId(id);
    setSchemaDraft(service?.customFieldsSchema ?? []);
    setError('');
    setSuccess('');
  };

  const updateField = (index: number, patch: Partial<CustomFieldDef>) => {
    setSchemaDraft(prev => prev.map((f, i) => i === index ? { ...f, ...patch } : f));
  };

  const addField = () => {
    setSchemaDraft(prev => [...prev, { ...EMPTY_FIELD }]);
  };

  const removeField = (index: number) => {
    setSchemaDraft(prev => prev.filter((_, i) => i !== index));
  };

  const handleOptionsChange = (index: number, text: string) => {
    const options = text.split(',').map(s => s.trim()).filter(Boolean);
    updateField(index, { options });
  };

  const handleSave = async () => {
    if (!selectedServiceId) return;
    setError('');
    setSuccess('');

    const validationError = validateSchema(schemaDraft);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      const res = await serviceApi.updateTemplate(selectedServiceId, schemaDraft);
      const updated: Service = res.data;
      setServices(prev => prev.map(s => s.id === updated.id ? updated : s));
      setSchemaDraft(updated.customFieldsSchema ?? []);
      setSuccess('Схема сохранена');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при сохранении схемы');
    } finally {
      setSaving(false);
    }
  };

  const selectedService = services.find(s => s.id === selectedServiceId);

  const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm bg-white outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all";
  const selectClass = `${inputClass} cursor-pointer`;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Загрузка услуг...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1.75rem' }}>
            Шаблоны полей заявки
          </h1>
          <p className="text-gray-500 text-sm mt-1" style={{ margin: '4px 0 0' }}>
            Дополнительные поля формы заявки, специфичные для каждой услуги
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

        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Услуга</label>
          <select value={selectedServiceId ?? ''} onChange={e => handleSelectService(parseInt(e.target.value))}
            className={selectClass} style={{ fontFamily: 'inherit', marginBottom: 0 }}>
            <option value="">— Выберите услугу —</option>
            {services.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.customFieldsSchema && s.customFieldsSchema.length > 0
                  ? `${s.customFieldsSchema.length} полей` : 'без полей'})
              </option>
            ))}
          </select>
        </div>

        {selectedService && (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-[#00B2FF] uppercase tracking-wider" style={{ margin: 0 }}>
                Поля для «{selectedService.name}»
              </p>
              <button onClick={addField}
                className="flex items-center gap-1 text-xs text-[#00B2FF] hover:text-[#0095D9] border-none bg-transparent cursor-pointer font-medium"
                style={{ marginBottom: 0 }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
                </svg>
                Добавить поле
              </button>
            </div>

            {schemaDraft.length === 0 && (
              <p className="text-sm text-gray-400 mb-4" style={{ margin: '0 0 16px' }}>
                У этой услуги пока нет дополнительных полей.
              </p>
            )}

            <div className="flex flex-col gap-3 mb-6">
              {schemaDraft.map((field, index) => (
                <div key={index} className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">Поле {index + 1}</span>
                    <button onClick={() => removeField(index)}
                      className="text-red-400 hover:text-red-600 border-none bg-transparent cursor-pointer text-xs"
                      style={{ marginBottom: 0 }}>Удалить</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Key (техническое имя) *</label>
                      <input type="text" value={field.key} onChange={e => updateField(index, { key: e.target.value })}
                        placeholder="например: batch_number" className={inputClass}
                        style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Label (подпись в форме) *</label>
                      <input type="text" value={field.label} onChange={e => updateField(index, { label: e.target.value })}
                        placeholder="например: Номер партии" className={inputClass}
                        style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Тип поля</label>
                      <select value={field.type} onChange={e => updateField(index, { type: e.target.value as CustomFieldType })}
                        className={selectClass} style={{ fontFamily: 'inherit', marginBottom: 0 }}>
                        {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Уровень</label>
                      <select value={field.scope} onChange={e => updateField(index, { scope: e.target.value as CustomFieldScope })}
                        className={selectClass} style={{ fontFamily: 'inherit', marginBottom: 0 }}>
                        {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  {field.type === 'select' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Варианты выбора (через запятую) *</label>
                      <input type="text" value={(field.options ?? []).join(', ')}
                        onChange={e => handleOptionsChange(index, e.target.value)}
                        placeholder="например: Казахстан, Россия, Китай" className={inputClass}
                        style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={field.required}
                      onChange={e => updateField(index, { required: e.target.checked })} />
                    Обязательное поле
                  </label>
                </div>
              ))}
            </div>

            <button onClick={handleSave} disabled={saving}
              className="w-full py-3 bg-[#00B2FF] hover:bg-[#0095D9] disabled:bg-blue-200 disabled:cursor-not-allowed text-white font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors"
              style={{ marginBottom: 0 }}>
              {saving ? 'Сохранение...' : 'Сохранить схему'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
