// Форматы вложений из макета заказчика — тот же список, что и в allowlist на
// бэкенде (orders/views.py: ALLOWED_ATTACHMENT_EXTENSIONS). Проверяем по
// расширению, а не по file.type: MIME у RAR браузеры сообщают по-разному,
// а сервер всё равно смотрит расширение и сигнатуру содержимого.
export const ALLOWED_ATTACHMENT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'rar'] as const;

export const ATTACHMENT_ACCEPT = '.pdf,.jpg,.jpeg,.rar';

export const ATTACHMENT_FORMATS_LABEL = 'PDF, JPG, JPEG, RAR';

// Пределы на один файл — те же, что на бэкенде (MAX_ATTACHMENT_MB /
// MAX_RECEIPT_MB в orders/views.py).
export const MAX_ATTACHMENT_MB = 7;
export const MAX_RECEIPT_MB = 3;

// Предел на СУММУ вложений одного запроса. Считается не от лимита на файл, а от
// DATA_UPLOAD_MAX_MEMORY_SIZE (20 МиБ на тело): файлы уходят base64-строкой,
// в 4/3 раза длиннее, значит сырых байт помещается 20 x 3/4 = 15 МиБ, минус
// обвязка JSON. Два файла по 7 МБ в один запрос проходят, по 8 — уже нет.
// Двигать только вместе с DATA_UPLOAD_MAX_MEMORY_SIZE.
export const MAX_REQUEST_TOTAL_MB = 14.5;

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

/** Размер исходного файла по длине его base64-строки. */
export function base64SizeMb(base64: string): number {
  return (base64.length * 3) / 4 / 1024 / 1024;
}

/**
 * Проверяет суммарный объём вложений, уходящих ОДНИМ запросом.
 * Именно этот случай на сервере упирается в потолок тела и возвращает 413.
 */
export function validateAttachmentsTotal(
  base64Files: (string | null | undefined)[],
  maxMb = MAX_REQUEST_TOTAL_MB,
): string | null {
  const total = base64Files.reduce((sum, b64) => sum + (b64 ? base64SizeMb(b64) : 0), 0);
  if (total > maxMb) {
    return `Вложения весят суммарно ${total.toFixed(1)} МБ. В одном запросе допустимо не больше ${maxMb} МБ`;
  }
  return null;
}
