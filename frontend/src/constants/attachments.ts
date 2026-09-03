// Форматы вложений из макета заказчика — тот же список, что и в allowlist на
// бэкенде (orders/views.py: ALLOWED_ATTACHMENT_EXTENSIONS). Проверяем по
// расширению, а не по file.type: MIME у RAR браузеры сообщают по-разному,
// а сервер всё равно смотрит расширение и сигнатуру содержимого.
export const ALLOWED_ATTACHMENT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'rar'] as const;

export const ATTACHMENT_ACCEPT = '.pdf,.jpg,.jpeg,.rar';

export const ATTACHMENT_FORMATS_LABEL = 'PDF, JPG, JPEG, RAR';

// Потолок задаёт не форма и не лимит во вьюхе (там 7 МБ), а
// DATA_UPLOAD_MAX_MEMORY_SIZE на бэкенде: 2.5 МиБ на ВСЁ тело запроса, и файл
// уходит в нём base64-строкой, то есть в 4/3 раза длиннее. Отсюда:
//   один файл в запросе  -> ~1.8 МБ,
//   два файла в запросе  -> ~0.9 МБ каждый (создание заявки, черновики экспертизы).
// Превышение ловится здесь, потому что на сервере оно приводит к 400 от самого
// Django с HTML-телом, которое фронт показать не может.
// Эти числа поднимаются ТОЛЬКО вместе с DATA_UPLOAD_MAX_MEMORY_SIZE.
export const MAX_ATTACHMENT_MB = 1.8;
export const MAX_PAIRED_ATTACHMENT_MB = 0.9;

export function hasAllowedAttachmentExtension(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return (ALLOWED_ATTACHMENT_EXTENSIONS as readonly string[]).includes(ext);
}

/** Возвращает текст ошибки либо null, если файл подходит. */
export function validateAttachment(file: File, maxMb = MAX_ATTACHMENT_MB): string | null {
  if (!hasAllowedAttachmentExtension(file.name)) {
    return `Недопустимый формат. Разрешены: ${ATTACHMENT_FORMATS_LABEL}`;
  }
  if (file.size > maxMb * 1024 * 1024) {
    const actual = (file.size / 1024 / 1024).toFixed(1);
    return `Файл слишком большой: ${actual} МБ. Максимум ${maxMb} МБ`;
  }
  return null;
}
