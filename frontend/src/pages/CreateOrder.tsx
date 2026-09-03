import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api, { serviceApi, orderApi, userApi } from '../services/api';
import CustomFieldsForm from '../components/CustomFieldsForm';
import { ATTACHMENT_ACCEPT, MAX_PAIRED_ATTACHMENT_MB, validateAttachment } from '../constants/attachments';
import type { Service, User, CustomFieldValues } from '../types';

export default function CreateOrder() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const draftId: number | undefined = location.state?.draftId;

  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<User[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    serviceId: location.state?.serviceId?.toString() || '',
    deviceType: '',
    model: '',
    serialNumber: '',
    quantity: '1',
    clientComment: '',
  });

  // Поля, специфичные для выбранной услуги (Service.customFieldsSchema).
  // Не чистится при смене serviceId нарочно: если клиент передумает и
  // вернётся к первой услуге, введённые данные не потеряются, а лишние
  // ключи для новой услуги бэкенд молча игнорирует при валидации.
  const [customFieldsValues, setCustomFieldsValues] = useState<CustomFieldValues>({});

  // Новый выбранный файл — та же схема, что и при первой подаче. Существующее
  // имя — то, что уже сохранено в черновике на бэкенде: пока пользователь не
  // выбрал новый файл, содержимое вложения в запрос вообще не попадает (см.
  // handleSave) — save_draft не трогает то, что не пришло, и не затирает его.
  const [powerOfAttorney, setPowerOfAttorney] = useState<{ data: string; name: string } | null>(null);
  const [techDocumentation, setTechDocumentation] = useState<{ data: string; name: string } | null>(null);
  const [existingPowerOfAttorneyName, setExistingPowerOfAttorneyName] = useState<string | null>(null);
  const [existingTechDocumentationName, setExistingTechDocumentationName] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const requests: Promise<any>[] = [serviceApi.getAll()];
      if (user?.role === 'manager') requests.push(userApi.getClients());
      const results = await Promise.all(requests);
      setServices(results[0].data);
      if (user?.role === 'manager' && results[1]) setClients(results[1].data);

      if (draftId) {
        const [orderRes, itemsRes] = await Promise.all([
          orderApi.getById(draftId),
          api.get(`/orders/${draftId}/items`),
        ]);
        const order = orderRes.data;
        const item = itemsRes.data[0];
        setFormData({
          serviceId: order.serviceId?.toString() || '',
          deviceType: item?.deviceType || '',
          model: item?.model || '',
          serialNumber: item?.serialNumber || '',
          quantity: (item?.quantity ?? 1).toString(),
          clientComment: order.clientComment || '',
        });
        setCustomFieldsValues(item?.customFieldsValues || {});
        setExistingPowerOfAttorneyName(order.powerOfAttorneyFileName || null);
        setExistingTechDocumentationName(order.techDocumentationFileName || null);
        if (user?.role === 'manager') setSelectedClientId(order.clientId);
      }
    } catch {
      setError('Ошибка при загрузке данных');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAttachmentChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setAttachment: (attachment: { data: string; name: string }) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Доверенность и документация уходят в ОДНОМ запросе, поэтому парный предел.
    const problem = validateAttachment(file, MAX_PAIRED_ATTACHMENT_MB);
    if (problem) {
      setError(problem);
      return;
    }
    const data = await readFileAsBase64(file);
    setAttachment({ data, name: file.name });
  };

  const handleSave = async (isDraft: boolean) => {
    setError('');
    setSuccess('');

    if (user?.role === 'manager' && !selectedClientId) {
      setError('Выберите клиента');
      return;
    }

    // Черновик по определению может быть неполным — обязательны только поля,
    // без которых нельзя завести саму позицию (совпадает с тем, что требует
    // схема БД). Остальное проверяется только при реальной отправке.
    if (!formData.serviceId || !formData.deviceType || !formData.serialNumber) {
      setError('Заполните все обязательные поля');
      return;
    }
    if (!isDraft) {
      // Как на бэкенде (_validate_custom_fields): required проверяется по
      // схеме услуги, а не по захардкоженному списку, а строка из одних
      // пробелов считается пустой (.trim() — фронтовый эквивалент .strip()),
      // чтобы вердикт совпадал по обе стороны на одном и том же вводе.
      const missingField = (selectedService?.customFieldsSchema ?? []).find(field => {
        if (!field.required) return false;
        const value = customFieldsValues[field.key];
        return value === undefined || value === null || String(value).trim() === '';
      });
      if (missingField) {
        setError(`Заполните поле «${missingField.label}»`);
        return;
      }
      if (!powerOfAttorney && !existingPowerOfAttorneyName) {
        setError('Прикрепите доверенность');
        return;
      }
      if (!techDocumentation && !existingTechDocumentationName) {
        setError('Прикрепите документацию на СИ');
        return;
      }
    }

    try {
      const payload: any = {
        clientId: user?.role === 'manager' ? selectedClientId : user?.id,
        serviceId: parseInt(formData.serviceId),
        // Лабораторию бэкенд берёт у услуги, дата сдачи на этом шаге не задаётся.
        clientComment: formData.clientComment || null,
        isDraft,
        orderItems: [{
          deviceType: formData.deviceType,
          model: formData.model,
          serialNumber: formData.serialNumber,
          quantity: parseInt(formData.quantity),
          // Снимок схемы фронт не шлёт - его проставляет сам бэкенд
          // (_create_order_items читает service.custom_fields_schema), так
          // что источник снимка ровно один.
          customFieldsValues,
        }],
      };

      // Ключ попадает в payload только если выбран новый файл — иначе
      // сохранённое на бэкенде вложение остаётся как есть (см. save_draft).
      if (powerOfAttorney) {
        payload.powerOfAttorneyFile = powerOfAttorney.data;
        payload.powerOfAttorneyFileName = powerOfAttorney.name;
      }
      if (techDocumentation) {
        payload.techDocumentationFile = techDocumentation.data;
        payload.techDocumentationFileName = techDocumentation.name;
      }

      if (draftId) {
        await orderApi.saveDraft(draftId, payload);
      } else {
        await orderApi.create(payload);
      }
      setSuccess(isDraft ? 'Черновик сохранён!' : 'Заявка отправлена успешно!');
      setTimeout(() => navigate('/orders'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при сохранении заявки');
    }
  };

  const selectedService = services.find(s => s.id === parseInt(formData.serviceId));

  const inputClass = "w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all bg-white";
  const selectClass = "w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all bg-white cursor-pointer";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Загрузка данных...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1.75rem' }}>
            {draftId ? 'Редактирование черновика' : 'Новая заявка'}
          </h1>
          <p className="text-gray-500 text-sm mt-1" style={{ margin: '4px 0 0' }}>
            Заполните форму для подачи заявки на метрологическую услугу
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

        <form onSubmit={e => e.preventDefault()} className="flex flex-col gap-6">

          {user?.role === 'manager' && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <p className="text-xs font-semibold text-[#00B2FF] uppercase tracking-wider mb-4" style={{ margin: '0 0 16px' }}>
                Клиент
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Выберите клиента *</label>
                <select value={selectedClientId || ''} onChange={e => setSelectedClientId(parseInt(e.target.value))}
                  className={selectClass} style={{ fontFamily: 'inherit', marginBottom: 0 }}>
                  <option value="">— Выберите клиента —</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.fullName} ({c.email})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <p className="text-xs font-semibold text-[#00B2FF] uppercase tracking-wider mb-4" style={{ margin: '0 0 16px' }}>
              Выберите услугу
            </p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Услуга *</label>
                <select name="serviceId" value={formData.serviceId} onChange={handleChange} required
                  className={selectClass} style={{ fontFamily: 'inherit', marginBottom: 0 }}>
                  <option value="">— Выберите услугу —</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.measurementType})
                    </option>
                  ))}
                </select>
              </div>
              {selectedService && (
                <div className="bg-[#00B2FF]/5 border-l-4 border-[#00B2FF] rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1" style={{ margin: '0 0 4px' }}>
                    <span className="font-semibold text-[#0A2E5C]">Описание: </span>
                    {selectedService.description}
                  </p>
                  <p className="text-sm text-gray-600" style={{ margin: 0 }}>
                    <span className="font-semibold text-[#0A2E5C]">Срок выполнения: </span>
                    {selectedService.durationDays} рабочих дней
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <p className="text-xs font-semibold text-[#00B2FF] uppercase tracking-wider mb-4" style={{ margin: '0 0 16px' }}>
              Информация о приборе
            </p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Тип прибора *</label>
                <input type="text" name="deviceType" value={formData.deviceType} onChange={handleChange}
                  placeholder="Манометр, Амперметр и т.д." required className={inputClass}
                  style={{ fontFamily: 'inherit', marginBottom: 0 }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Модель</label>
                <input type="text" name="model" value={formData.model} onChange={handleChange}
                  placeholder="Модель прибора" className={inputClass}
                  style={{ fontFamily: 'inherit', marginBottom: 0 }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Серийный номер *</label>
                <input type="text" name="serialNumber" value={formData.serialNumber} onChange={handleChange}
                  placeholder="Введите серийный номер" required className={inputClass}
                  style={{ fontFamily: 'inherit', marginBottom: 0 }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Количество *</label>
                <input type="number" name="quantity" value={formData.quantity} onChange={handleChange}
                  min="1" required className={inputClass}
                  style={{ fontFamily: 'inherit', marginBottom: 0 }} />
              </div>
            </div>
          </div>

          {selectedService?.customFieldsSchema && selectedService.customFieldsSchema.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <CustomFieldsForm
                schema={selectedService.customFieldsSchema}
                values={customFieldsValues}
                onChange={setCustomFieldsValues}
              />
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <p className="text-xs font-semibold text-[#00B2FF] uppercase tracking-wider mb-4" style={{ margin: '0 0 16px' }}>
              Вложения
            </p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Доверенность * <span className="text-gray-400 font-normal">(необязательно для черновика)</span></label>
                <input type="file" accept={ATTACHMENT_ACCEPT}
                  onChange={e => handleAttachmentChange(e, setPowerOfAttorney)}
                  className="w-full text-sm text-gray-700" style={{ marginBottom: 0 }} />
                {powerOfAttorney ? (
                  <p className="text-xs text-green-600 mt-1" style={{ margin: '4px 0 0' }}>{powerOfAttorney.name}</p>
                ) : existingPowerOfAttorneyName && (
                  <p className="text-xs text-gray-500 mt-1" style={{ margin: '4px 0 0' }}>Уже прикреплено: {existingPowerOfAttorneyName}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Документация на СИ * <span className="text-gray-400 font-normal">(необязательно для черновика)</span></label>
                <input type="file" accept={ATTACHMENT_ACCEPT}
                  onChange={e => handleAttachmentChange(e, setTechDocumentation)}
                  className="w-full text-sm text-gray-700" style={{ marginBottom: 0 }} />
                {techDocumentation ? (
                  <p className="text-xs text-green-600 mt-1" style={{ margin: '4px 0 0' }}>{techDocumentation.name}</p>
                ) : existingTechDocumentationName && (
                  <p className="text-xs text-gray-500 mt-1" style={{ margin: '4px 0 0' }}>Уже прикреплено: {existingTechDocumentationName}</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <p className="text-xs font-semibold text-[#00B2FF] uppercase tracking-wider mb-4" style={{ margin: '0 0 16px' }}>
              Комментарий
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Дополнительные пожелания (необязательно)
              </label>
              <textarea name="clientComment" value={formData.clientComment} onChange={handleChange}
                placeholder="Опишите особенности приборов, срочность, дополнительные требования..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all bg-white resize-none"
                style={{ fontFamily: 'inherit', marginBottom: 0 }} />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => handleSave(true)}
              className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl border-none cursor-pointer text-base transition-colors"
              style={{ marginBottom: 0 }}>
              Сохранить как черновик
            </button>
            <button type="button" onClick={() => handleSave(false)}
              className="flex-1 py-4 bg-[#00B2FF] hover:bg-[#0095D9] text-white font-semibold rounded-xl border-none cursor-pointer text-base transition-colors"
              style={{ marginBottom: 0 }}>
              Отправить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
