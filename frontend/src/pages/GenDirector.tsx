import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { contractApi, laboratoryApi } from '../services/api';
import api from '../services/api';
import type { Order, Contract, Laboratory } from '../types';

export default function GenDirector() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'sign' | 'assign'>('sign');

  // Заявки где тройка + клиент уже подписали, ген.дир ещё нет
  const [signOrders, setSignOrders] = useState<Order[]>([]);
  const [contracts, setContracts] = useState<Record<number, Contract>>({});
  const [assignOrders, setAssignOrders] = useState<Order[]>([]);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [signing, setSigning] = useState<number | null>(null);
  const [showReject, setShowReject] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const [downloadingContract, setDownloadingContract] = useState<number | null>(null);
  const [selectedLabs, setSelectedLabs] = useState<Record<number, string>>({});
  const [assigning, setAssigning] = useState<number | null>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setIsLoading(true);
      // Загружаем заявки в awaiting_approval + awaiting_delivery
      const [approvalRes, deliveryRes, labRes] = await Promise.all([
        api.get('/orders/status/awaiting_approval'),
        api.get('/orders/status/awaiting_delivery'),
        laboratoryApi.getAll(),
      ]);

      setAssignOrders(deliveryRes.data);
      setLaboratories(labRes.data);

      // Загружаем договоры и фильтруем: только те где тройка + клиент подписали
      const allOrders: Order[] = approvalRes.data;
      const contractMap: Record<number, Contract> = {};

      await Promise.all(allOrders.map(async (order) => {
        try {
          const c = await contractApi.getByOrderId(order.id);
          contractMap[order.id] = c.data;
        } catch {}
      }));

      setContracts(contractMap);

      // Ген.дир видит только договоры где тройка + клиент уже подписали
      const forGenDirector = allOrders.filter(o => {
        const c = contractMap[o.id];
        return c && c.approverSigned && c.financierSigned && c.directorSigned && c.clientSigned && !c.genDirectorSigned;
      });
      setSignOrders(forGenDirector);

    } catch {
      setError('Ошибка при загрузке данных');
    } finally {
      setIsLoading(false);
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
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contract_${orderNumber}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Ошибка при скачивании договора');
    } finally {
      setDownloadingContract(null);
    }
  };

  const handleSign = async (orderId: number) => {
    if (!window.confirm('Подписать договор ЭЦП? Это финальная подпись — договор вступит в силу.')) return;
    try {
      setSigning(orderId);
      await contractApi.signByGenDirector(orderId, user?.id || 0);
      setSignOrders(prev => prev.filter(o => o.id !== orderId));
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
      await contractApi.reject(orderId, user?.id || 0, reason, 'gen_director');
      setSignOrders(prev => prev.filter(o => o.id !== orderId));
      setShowReject(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при отклонении');
    }
  };

  const handleAssign = async (orderId: number) => {
    const labId = parseInt(selectedLabs[orderId] || '');
    if (!labId) { setError('Выберите лабораторию'); return; }
    if (!window.confirm('Направить заявку в выбранную лабораторию?')) return;
    try {
      setAssigning(orderId);
      await api.put(`/orders/${orderId}/assign-lab`, { labId });
      setAssignOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при направлении');
    } finally {
      setAssigning(null);
    }
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('ru-RU') : 'Не указана';

  const tabClass = (tab: 'sign' | 'assign') =>
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
            Кабинет генерального директора
          </h1>
          <p className="text-gray-500 text-sm mt-1" style={{ margin: '4px 0 0' }}>
            Финальное подписание договоров и направление заявок на исполнение
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

        <div className="flex gap-2 mb-6">
          <button onClick={() => setActiveTab('sign')} className={tabClass('sign')} style={{ marginBottom: 0 }}>
            Финальное подписание
            {signOrders.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {signOrders.length}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab('assign')} className={tabClass('assign')} style={{ marginBottom: 0 }}>
            Направить на исполнение
            {assignOrders.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {assignOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Финальное подписание ────────────────────────────────────────── */}
        {activeTab === 'sign' && (
          signOrders.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-sm">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <p className="text-gray-400">Нет договоров ожидающих финальной подписи</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {signOrders.map(order => {
                const contract = contracts[order.id];
                return (
                  <div key={order.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                      <h3 className="font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1rem' }}>
                        Заявка #{order.orderNumber}
                      </h3>
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-100 text-indigo-700">
                        Ожидает финальной подписи
                      </span>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 mb-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5" style={{ margin: '0 0 2px' }}>Плановая дата</p>
                        <p className="text-sm font-semibold text-gray-700" style={{ margin: 0 }}>{formatDate(order.dueDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5" style={{ margin: '0 0 2px' }}>Лаборатория</p>
                        <p className="text-sm font-semibold text-gray-700" style={{ margin: 0 }}>#{order.labId}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5" style={{ margin: '0 0 2px' }}>Номер договора</p>
                        <p className="text-sm font-semibold text-gray-700" style={{ margin: 0 }}>{contract?.contractNumber || '—'}</p>
                      </div>
                    </div>

                    {/* Прогресс всех 5 подписей */}
                    {contract && (
                      <div className="flex gap-2 mb-4 flex-wrap">
                        {[
                          { label: 'Согласующий', signed: contract.approverSigned },
                          { label: 'Финансист',   signed: contract.financierSigned },
                          { label: 'Директор',    signed: contract.directorSigned },
                          { label: 'Клиент',      signed: contract.clientSigned },
                          { label: 'Ген.директор', signed: contract.genDirectorSigned },
                        ].map(({ label, signed }) => (
                          <span key={label} className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                            signed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                          }`}>
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
                      <button onClick={() => handleDownloadContract(order.id, order.orderNumber)}
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
                        <textarea value={rejectReason[order.id] || ''}
                          onChange={e => setRejectReason(prev => ({ ...prev, [order.id]: e.target.value }))}
                          placeholder="Укажите причину отклонения..."
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-red-400 resize-none"
                          rows={3} style={{ fontFamily: 'inherit', marginBottom: '8px' }} />
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
                        <button onClick={() => handleSign(order.id)} disabled={signing === order.id}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 text-white font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-2"
                          style={{ marginBottom: 0 }}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                          {signing === order.id ? 'Подписание...' : 'Подписать ЭЦП (финал)'}
                        </button>
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

        {/* ── Направить на исполнение ─────────────────────────────────────── */}
        {activeTab === 'assign' && (
          assignOrders.length === 0 ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-sm">
              <p className="text-gray-400">Нет заявок ожидающих направления</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {assignOrders.map(order => (
                <div key={order.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <h3 className="font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1rem' }}>
                      Заявка #{order.orderNumber}
                    </h3>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-700">
                      Ожидает направления
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 mb-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5" style={{ margin: '0 0 2px' }}>Плановая дата</p>
                      <p className="text-sm font-semibold text-gray-700" style={{ margin: 0 }}>{formatDate(order.dueDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5" style={{ margin: '0 0 2px' }}>Запрошена лаб.</p>
                      <p className="text-sm font-semibold text-gray-700" style={{ margin: 0 }}>
                        {laboratories.find(l => l.id === order.labId)?.name || `#${order.labId}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <select value={selectedLabs[order.id] || ''}
                      onChange={e => setSelectedLabs(prev => ({ ...prev, [order.id]: e.target.value }))}
                      className="flex-1 min-w-[200px] px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 cursor-pointer"
                      style={{ fontFamily: 'inherit', marginBottom: 0 }}>
                      <option value="">— Выберите филиал / лабораторию —</option>
                      {laboratories.map(lab => (
                        <option key={lab.id} value={lab.id}>
                          {lab.name}{lab.city ? ` (${lab.city})` : ''}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => handleAssign(order.id)}
                      disabled={!selectedLabs[order.id] || assigning === order.id}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-medium rounded-xl border-none cursor-pointer text-sm transition-colors flex items-center gap-2"
                      style={{ marginBottom: 0 }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
                      </svg>
                      {assigning === order.id ? 'Направление...' : 'Направить'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}