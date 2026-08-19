// Утилита для скачивания файлов — используется в MyOrders и Queue
// Избегает дублирования кода в двух компонентах

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
    const response = await fetch(`http://localhost:8081/api/pdf/certificate/${orderId}`, {
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

// Скачивает PDF договора для заявки
// Если договор ещё не создан — создаёт его автоматически
export const downloadContract = async (
  orderId: number,
  orderNumber: string,
  api: any,
  setError: (msg: string) => void
) => {
  try {
    await api.post(`/contracts/${orderId}`);
    const token = localStorage.getItem('token');
    const response = await fetch(`http://localhost:8081/api/contracts/${orderId}/download`, {
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