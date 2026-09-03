// Форматы вложений из макета заказчика — тот же список, что и в allowlist на
// бэкенде (orders/views.py: ALLOWED_ATTACHMENT_EXTENSIONS). Проверяем по
// расширению, а не по file.type: MIME у RAR браузеры сообщают по-разному,
// а сервер всё равно смотрит расширение и сигнатуру содержимого.
export const ALLOWED_ATTACHMENT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'rar'] as const;

export const ATTACHMENT_ACCEPT = '.pdf,.jpg,.jpeg,.rar';

export const ATTACHMENT_FORMATS_LABEL = 'PDF, JPG, JPEG, RAR';

export function hasAllowedAttachmentExtension(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return (ALLOWED_ATTACHMENT_EXTENSIONS as readonly string[]).includes(ext);
}
