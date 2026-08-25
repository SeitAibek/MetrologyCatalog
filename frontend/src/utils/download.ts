// Утилита для скачивания файлов — используется в MyOrders и Queue
// Избегает дублирования кода в двух компонентах

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';

// Скачивает PDF сертификат/протокол/отчёт для завершённой заявки
export const downloadCertificate = async (
  orderId: number,
  orderNumber: string,
  setError: (msg: string) => void,
  setDownloadingId?: (id: number | null) => void
) => {
  try {
    setDownloadingId?.(orderId);
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/pdf/certificate/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) throw new Error('Ошибка загрузки PDF');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certificate_${orderNumber}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    setError('Не удалось скачать PDF');
  } finally {
    setDownloadingId?.(null);
  }
};

// Скачивает PDF договора для заявки.
// Бэкенд сам генерирует PDF по шаблону, если файл договора ещё не загружен менеджером.
export const downloadContract = async (
  orderId: number,
  orderNumber: string,
  setError: (msg: string) => void
) => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/contracts/${orderId}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) throw new Error('Ошибка загрузки');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contract_${orderNumber}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    setError('Ошибка при загрузке договора');
  }
};