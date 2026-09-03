import type { CustomFieldDef, CustomFieldValues } from '../types';

const inputClass = "w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all bg-white text-gray-900";

interface CustomFieldsFormProps {
  // Уже отфильтрованный по нужному scope срез схемы услуги - компонент сам
  // scope не различает, вызывающий код решает, item- или order-уровень он
  // рендерит и с каким объектом values это связано.
  schema?: CustomFieldDef[] | null;
  values?: CustomFieldValues | null;
  onChange: (values: CustomFieldValues) => void;
  title?: string;
}

export default function CustomFieldsForm({
  schema, values, onChange, title = 'Дополнительные сведения',
}: CustomFieldsFormProps) {
  if (!schema || schema.length === 0) return null;

  const safeValues = values ?? {};

  const handleFieldChange = (key: string, value: string) => {
    // Спред от safeValues, а не пересборка из схемы - значения ключей, которых
    // в схеме больше нет (шаблон услуги успел измениться), не теряются.
    onChange({ ...safeValues, [key]: value });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      {schema.map((field) => {
        const rawValue = safeValues[field.key];
        const value = rawValue === undefined || rawValue === null ? '' : String(rawValue);

        return (
          <div key={field.key}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {field.label}{field.required && ' *'}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                value={value}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                rows={3}
                className={inputClass}
              />
            ) : field.type === 'select' ? (
              <select
                value={value}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                className={inputClass}
              >
                <option value="">Выберите...</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            ) : (
              <input
                // Неизвестный type (схема пришла из БД и могла быть записана более
                // новой версией фронта) рендерится как обычный текстовый инпут.
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                value={value}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                className={inputClass}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
