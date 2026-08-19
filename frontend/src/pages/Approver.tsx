import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { orderApi, contractApi } from '../services/api';
import type { Order, Contract } from '../types';

export default function Approver() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [contracts, setContracts] = useState<Record<number, Contract>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const [showReject, setShowReject] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [signing, setSigning] = useState<number | null>(null);

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const res = await orderApi.getByStatus('awaiting_approval');
      setOrders(res.data);
      // Загружаем статусы договоров для отображения прогресса подписей
      const contractMap: Record<number, Contract> = {};
      await Promise.all(res.data.map(async (order: Order) => {
        try {
          const c = await contractApi.getByOrderId(order.id);
          contractMap[order.id] = c.data;
        } catch {}
      }));
      setContracts(contractMap);
    } catch {
      setError('Ошибка при загрузке заявок');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (orderId: number, orderNumber: string) => {
    try {
      setDownloadingId(orderId);
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';
      const response = await fetch(`${baseUrl}/contracts/${orderId}/file`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract_${orderNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Ошибка при скачивании договора');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSign = async (orderId: number) => {
    if (!window.confirm('Подписать договор?')) return;
    try {
      setSigning(orderId);
      await contractApi.signByApprover(orderId, user?.id || 0);
      await fetchOrders();
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
      await contractApi.reject(orderId, user?.id || 0, reason, 'approver');
      setOrders(prev => prev.filter(o => o.id !== orderId));
      setShowReject(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при отклонении');
    }
  };

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
            Согласование договоров
          </h1>
          <p className="text-gray-500 text-sm mt-1" style={{ margin: '4px 0 0' }}>
            Договоры ожидающие вашей подписи
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

        {orders.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-sm">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <p className="text-gray-400">Нет договоров для согласования</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {orders.map(order => {
              const contract = contracts[order.id];
              const alreadySigned = contract?.approverSigned;
              return (
                <div key={order.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <h3 className="font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1rem' }}>
                      Заявка #{order.orderNumber}
                    </h3>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${alreadySigned ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
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
                      onClick={() => handleDownload(order.id, order.orderNumber)}
                      disabled={downloadingId === order.id}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-2"
                      style={{ marginBottom: 0 }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/>
                        <path d="M14 2v5a1 1 0 0 0 1 1h5"/>
                      </svg>
                      {downloadingId === order.id ? 'Загрузка...' : 'Скачать договор'}
                    </button>
                  </div>

                  {showReject === order.id ? (
                    <div>
                      <textarea
                        value={rejectReason[order.id] || ''}
                        onChange={e => setRejectReason(prev => ({ ...prev, [order.id]: e.target.value }))}
                        placeholder="Укажите причину отклонения..."
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all resize-none mb-2"
                        rows={3}
                        style={{ fontFamily: 'inherit', marginBottom: '8px' }}
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleReject(order.id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg border-none cursor-pointer text-sm transition-colors"
                          style={{ marginBottom: 0 }}>
                          Отклонить
                        </button>
                        <button onClick={() => setShowReject(null)}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-lg border-none cursor-pointer text-sm transition-colors"
                          style={{ marginBottom: 0 }}>
                          Отмена
                        </button>
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
                      <button
                        onClick={() => setShowReject(order.id)}
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
        )}
      </div>
    </div>
  );
}