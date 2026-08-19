import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { orderApi, contractApi, pdfApi } from '../services/api';
import type { Order, Contract } from '../types';

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

export default function Financier() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'sign' | 'payment'>('sign');

  // Вкладка: подписание договоров
  const [signOrders, setSignOrders] = useState<Order[]>([]);
  const [contracts, setContracts] = useState<Record<number, Contract>>({});
  const [signing, setSigning] = useState<number | null>(null);
  const [showReject, setShowReject] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const [downloadingContract, setDownloadingContract] = useState<number | null>(null);

  // Вкладка: счета и оплаты
  const [paymentOrders, setPaymentOrders] = useState<Order[]>([]);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [processing, setProcessing] = useState<number | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState<number | null>(null);
  const [receiptModal, setReceiptModal] = useState<{
    orderId: number; orderNumber: string; fileData: string; fileName: string; uploadedAt: string;
  } | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState<number | null>(null);
  const [settingPrice, setSettingPrice] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setIsLoading(true);
      const [signRes, paymentRes] = await Promise.all([
        orderApi.getByStatus('awaiting_approval'),
        orderApi.getByStatus('awaiting_payment'),
      ]);
      setSignOrders(signRes.data);
      setPaymentOrders(paymentRes.data);

      // Загружаем договоры для прогресса подписей
      const contractMap: Record<number, Contract> = {};
      await Promise.all(signRes.data.map(async (order: Order) => {
        try {
          const c = await contractApi.getByOrderId(order.id);
          contractMap[order.id] = c.data;
        } catch {}
      }));
      setContracts(contractMap);
    } catch {
      setError('Ошибка при загрузке данных');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Подписание договора ─────────────────────────────────────────────────
  const handleSign = async (orderId: number) => {
    if (!window.confirm('Подписать договор?')) return;
    try {
      setSigning(orderId);
      await contractApi.signByFinancier(orderId, user?.id || 0);
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при подписании');
    } finally {
      setSigning(null);
    }
  };

  const handleReject = async (orderId: number) => {
    const reason = rejectReason[orderId];
    if (!reason?.trim()) { setError('Укажите причину отклонения'); return; }
    try {
      await contractApi.reject(orderId, user?.id || 0, reason, 'financier');
      setSignOrders(prev => prev.filter(o => o.id !== orderId));
      setShowReject(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при отклонении');
    }
  };

  const handleDownloadContract = async (orderId: number, orderNumber: string) => {
    try {
      setDownloadingContract(orderId);
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';
      const res = await fetch(`${baseUrl}/contracts/${orderId}/file`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      downloadBlob(blob, `contract_${orderNumber}.pdf`);
    } catch {
      setError('Ошибка при скачивании договора');
    } finally {
      setDownloadingContract(null);
    }
  };

  const handlePayment = async (orderId: number, paid: boolean) => {
    const label = paid ? 'подтвердить оплату' : 'пропустить оплату';
    if (!window.confirm(`${label.charAt(0).toUpperCase() + label.slice(1)}?`)) return;
    try {
      setProcessing(orderId);
      const price = prices[orderId] ? parseFloat(prices[orderId]) : null;
      await orderApi.confirmPayment(orderId, paid, comments[orderId], price);
      setPaymentOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при обработке оплаты');
    } finally {
      setProcessing(null);
    }
  };


  const handleSetPrice = async (orderId: number) => {
    const price = prices[orderId] ? parseFloat(prices[orderId]) : null;
    if (!price || price <= 0) { setError('Введите цену больше 0'); return; }
    try {
      setSettingPrice(orderId);
      await orderApi.setPrice(orderId, price);
      setPaymentOrders(prev => prev.map(o => o.id === orderId ? { ...o, price } : o));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при объявлении цены');
    } finally {
      setSettingPrice(null);
    }
  };

  const handleDownloadInvoice = async (order: Order) => {
    try {
      setDownloadingInvoice(order.id);
      const res = await pdfApi.downloadInvoice(order.id);
      downloadBlob(res.data, `invoice_${order.orderNumber}.pdf`);
    } catch {
      setError('Ошибка при генерации счёта');
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const handleViewReceipt = async (order: Order) => {
    try {
      setLoadingReceipt(order.id);
      const res = await orderApi.getReceipt(order.id);
      setReceiptModal({
        orderId: order.id, orderNumber: order.orderNumber,
        fileData: res.data.fileData, fileName: res.data.fileName, uploadedAt: res.data.uploadedAt,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при получении чека');
    } finally {
      setLoadingReceipt(null);
    }
  };

  const handleDownloadReceipt = () => {
    if (!receiptModal) return;
    const { fileData, fileName } = receiptModal;
    const isPdf = fileName.toLowerCase().endsWith('.pdf');
    const byteString = atob(fileData);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    downloadBlob(new Blob([ab], { type: isPdf ? 'application/pdf' : 'image/jpeg' }), fileName);
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleString('ru-RU') : '—';
  const isImage = (f?: string) => !!f && /\.(jpg|jpeg|png|webp)$/i.test(f);

  const tabClass = (tab: 'sign' | 'payment') =>
    `px-5 py-2.5 text-sm font-semibold rounded-xl border-none cursor-pointer transition-colors ${
      activeTab === tab ? 'bg-[#0A2E5C] text-white' : 'bg-white text-gray-500 hover:bg-gray-100'
    }`;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Загрузка...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1.75rem' }}>
            Кабинет финансиста
          </h1>
          <p className="text-gray-500 text-sm mt-1" style={{ margin: '4px 0 0' }}>
            Подписание договоров и подтверждение оплат
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-6 text-red-600 text-sm">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
            </svg>
            {error}
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600 border-none bg-transparent cursor-pointer text-lg" style={{ marginBottom: 0 }}>×</button>
          </div>
        )}

        {/* Табы */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab('sign')} className={tabClass('sign')} style={{ marginBottom: 0 }}>
            Подписание договоров
            {signOrders.filter(o => !contracts[o.id]?.financierSigned).length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {signOrders.filter(o => !contracts[o.id]?.financierSigned).length}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab('payment')} className={tabClass('payment')} style={{ marginBottom: 0 }}>
            Счета и оплаты
            {paymentOrders.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {paymentOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Вкладка: подписание договоров ──────────────────────────────── */}
        {activeTab === 'sign' && (
          signOrders.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-sm">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <p className="text-gray-400">Нет договоров для подписания</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {signOrders.map(order => {
                const contract = contracts[order.id];
                const alreadySigned = contract?.financierSigned;
                return (
                  <div key={order.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                      <h3 className="font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1rem' }}>
                        Заявка #{order.orderNumber}
                      </h3>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${alreadySigned ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {alreadySigned ? 'Вы подписали' : 'Ожидает вашей подписи'}
                      </span>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 mb-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5" style={{ margin: '0 0 2px' }}>Клиент ID</p>
                        <p className="text-sm font-semibold text-gray-700" style={{ margin: 0 }}>#{order.clientId}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5" style={{ margin: '0 0 2px' }}>Лаборатория</p>
                        <p className="text-sm font-semibold text-gray-700" style={{ margin: 0 }}>#{order.labId}</p>
                      </div>
                    </div>

                    {/* Прогресс параллельных подписей */}
                    {contract && (
                      <div className="flex gap-2 mb-4 flex-wrap">
                        {[
                          { label: 'Согласующий', signed: contract.approverSigned },
                          { label: 'Финансист',   signed: contract.financierSigned },
                          { label: 'Директор',    signed: contract.directorSigned },
                        ].map(({ label, signed }) => (
                          <span key={label} className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${signed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                            {signed
                              ? <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="m9 11 3 3L22 4"/></svg>
                              : <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
                            }
                            {label}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => handleDownloadContract(order.id, order.orderNumber)}
                        disabled={downloadingContract === order.id}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-2"
                        style={{ marginBottom: 0 }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/>
                          <path d="M14 2v5a1 1 0 0 0 1 1h5"/>
                        </svg>
                        {downloadingContract === order.id ? 'Загрузка...' : 'Скачать договор'}
                      </button>
                    </div>

                    {showReject === order.id ? (
                      <div>
                        <textarea
                          value={rejectReason[order.id] || ''}
                          onChange={e => setRejectReason(prev => ({ ...prev, [order.id]: e.target.value }))}
                          placeholder="Укажите причину отклонения..."
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-red-400 resize-none"
                          rows={3}
                          style={{ fontFamily: 'inherit', marginBottom: '8px' }}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => handleReject(order.id)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg border-none cursor-pointer text-sm"
                            style={{ marginBottom: 0 }}>Отклонить</button>
                          <button onClick={() => setShowReject(null)}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-lg border-none cursor-pointer text-sm"
                            style={{ marginBottom: 0 }}>Отмена</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {!alreadySigned && (
                          <button
                            onClick={() => handleSign(order.id)}
                            disabled={signing === order.id}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 text-white font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-2"
                            style={{ marginBottom: 0 }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path d="m9 11 3 3L22 4"/>
                            </svg>
                            {signing === order.id ? 'Подписание...' : 'Подписать'}
                          </button>
                        )}
                        <button onClick={() => setShowReject(order.id)}
                          className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-2"
                          style={{ marginBottom: 0 }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path d="M18 6 6 18M6 6l12 12"/>
                          </svg>
                          Отклонить
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── Вкладка: счета и оплаты ─────────────────────────────────────── */}
        {activeTab === 'payment' && (
          paymentOrders.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-sm">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
              </svg>
              <p className="text-gray-400">Нет заявок ожидающих оплаты</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {paymentOrders.map(order => (
                <div key={order.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <h3 className="font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1rem' }}>
                      Заявка #{order.orderNumber}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-yellow-100 text-yellow-700">
                        Ожидает оплаты
                      </span>
                      {order.invoiceSent && (
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="m9 11 3 3L22 4"/></svg>
                          Счёт отправлен
                        </span>
                      )}
                      {order.paymentReceiptName ? (
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="m9 11 3 3L22 4"/></svg>
                          Чек загружен
                        </span>
                      ) : (
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-500">
                          Чек не загружен
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 mb-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5" style={{ margin: '0 0 2px' }}>Клиент ID</p>
                      <p className="text-sm font-semibold text-gray-700" style={{ margin: 0 }}>#{order.clientId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5" style={{ margin: '0 0 2px' }}>Чек загружен</p>
                      <p className="text-sm font-semibold text-gray-700" style={{ margin: 0 }}>{formatDate(order.receiptUploadedAt)}</p>
                    </div>
                  </div>

                  {order.price == null ? (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Объявить цену *</label>
                      <div className="flex gap-2">
                        <input type="number" value={prices[order.id] || ''}
                          onChange={e => setPrices((prev: Record<number, string>) => ({ ...prev, [order.id]: e.target.value }))}
                          placeholder="Введите сумму в тенге..."
                          className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all"
                          style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                        <button onClick={() => handleSetPrice(order.id)} disabled={settingPrice === order.id || !prices[order.id]}
                          className="px-4 py-3 bg-[#0A2E5C] hover:bg-[#0d3a73] disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-medium rounded-xl border-none cursor-pointer text-sm transition-colors whitespace-nowrap"
                          style={{ marginBottom: 0 }}>
                          {settingPrice === order.id ? 'Сохранение...' : 'Объявить цену'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                      <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="m9 11 3 3L22 4"/>
                      </svg>
                      <div>
                        <p className="text-xs text-green-600" style={{ margin: 0 }}>Цена объявлена</p>
                        <p className="text-sm font-bold text-green-700" style={{ margin: 0 }}>{order.price?.toLocaleString()} ₸</p>
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Комментарий</label>
                    <textarea value={comments[order.id] || ''}
                      onChange={e => setComments(prev => ({ ...prev, [order.id]: e.target.value }))}
                      placeholder="Оплата получена..."
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all resize-none"
                      rows={2} style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {order.paymentReceiptName && (
                      <button onClick={() => handleViewReceipt(order)} disabled={loadingReceipt === order.id}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-800 disabled:bg-gray-200 text-white font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-2"
                        style={{ marginBottom: 0 }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                        {loadingReceipt === order.id ? 'Загрузка...' : 'Просмотреть чек'}
                      </button>
                    )}
                    <button onClick={() => handleDownloadInvoice(order)} disabled={downloadingInvoice === order.id}
                      className="px-4 py-2 bg-[#0A2E5C] hover:bg-[#0d3a73] disabled:bg-gray-300 text-white font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-2"
                      style={{ marginBottom: 0 }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      {downloadingInvoice === order.id ? 'Генерация...' : 'Скачать счёт PDF'}
                    </button>
                    <button onClick={() => handlePayment(order.id, true)}
                      disabled={processing === order.id || order.price == null || !order.paymentReceiptName}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-2"
                      title={!order.paymentReceiptName ? 'Ожидается чек от клиента' : order.price == null ? 'Сначала объявите цену' : ''}
                      style={{ marginBottom: 0 }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path d="m9 11 3 3L22 4"/></svg>
                      {processing === order.id ? 'Обработка...' : 'Подтвердить оплату'}
                    </button>
                    <button onClick={() => handlePayment(order.id, false)} disabled={processing === order.id}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-lg border-none cursor-pointer text-sm transition-colors"
                      style={{ marginBottom: 0 }}>
                      Пропустить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ─── Модалка просмотра чека ──────────────────────────────────────── */}
      {receiptModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4"
          onClick={e => { if (e.target === e.currentTarget) setReceiptModal(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1.1rem' }}>Чек об оплате</h2>
                <p className="text-xs text-gray-500 mt-0.5" style={{ margin: '2px 0 0' }}>
                  Заявка #{receiptModal.orderNumber} · {receiptModal.fileName} · {formatDate(receiptModal.uploadedAt)}
                </p>
              </div>
              <button onClick={() => setReceiptModal(null)}
                className="text-gray-400 hover:text-gray-600 border-none bg-transparent cursor-pointer text-2xl" style={{ marginBottom: 0 }}>×</button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-50">
              {isImage(receiptModal.fileName) ? (
                <img src={`data:image/jpeg;base64,${receiptModal.fileData}`} alt="Чек"
                  className="max-w-full max-h-[60vh] rounded-xl shadow-md object-contain" />
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/>
                    <path d="M14 2v5a1 1 0 0 0 1 1h5"/>
                  </svg>
                  <p className="text-gray-600 font-medium" style={{ margin: '0 0 4px' }}>{receiptModal.fileName}</p>
                  <p className="text-sm text-gray-400" style={{ margin: 0 }}>PDF — используйте кнопку "Скачать"</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={handleDownloadReceipt}
                className="flex-1 py-3 bg-[#0A2E5C] hover:bg-[#0d3a73] text-white font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors flex items-center justify-center gap-2"
                style={{ marginBottom: 0 }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Скачать
              </button>
              <button onClick={() => setReceiptModal(null)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl border-none cursor-pointer text-sm"
                style={{ marginBottom: 0 }}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}