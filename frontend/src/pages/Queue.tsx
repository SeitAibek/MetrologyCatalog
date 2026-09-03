import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api, { orderApi, messageApi } from '../services/api';
import type { Order, Message } from '../types';
import { downloadCertificate, downloadContract } from '../utils/download';
import { ORDER_STATUS_LABELS_QUEUE, ORDER_STATUS_COLORS } from '../constants/orderStatus';
import { ATTACHMENT_ACCEPT, validateAttachment, validateAttachmentsTotal } from '../constants/attachments';

export default function Queue() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [resultType, setResultType] = useState('certificate');
  const [submitting, setSubmitting] = useState(false);

  const [showExpertiseModal, setShowExpertiseModal] = useState(false);
  const [testProgramDraft, setTestProgramDraft] = useState<{ data: string; name: string } | null>(null);
  const [typeDescriptionDraft, setTypeDescriptionDraft] = useState<{ data: string; name: string } | null>(null);
  const [expertiseConclusion, setExpertiseConclusion] = useState('');
  const [submittingExpertise, setSubmittingExpertise] = useState(false);

  const [messages, setMessages] = useState<Record<number, Message[]>>({});
  const [chatOpen, setChatOpen] = useState<number | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const statusLabels = ORDER_STATUS_LABELS_QUEUE;

  const statusFlow: Record<string, string> = {
    received_in_lab: 'expertise',
    expertise:       'in_work',
    in_work:         'under_review',
    under_review:    'completed',
  };

  const statusColors = ORDER_STATUS_COLORS;

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      // Для metrolog бэкенд сам фильтрует по личному назначению (Order.metrologist);
      // labId здесь больше не нужен.
      const response = await orderApi.getAll();
      setOrders(response.data);
    } catch {
      setError('Ошибка при загрузке заявок');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (orderId: number) => {
    try {
      const res = await messageApi.getByOrderId(orderId);
      setMessages(prev => ({ ...prev, [orderId]: res.data }));
    } catch {}
  };

  const handleOpenChat = (orderId: number) => {
    setChatOpen(prev => prev === orderId ? null : orderId);
    if (chatOpen !== orderId) fetchMessages(orderId);
  };

  const handleSendMessage = async (orderId: number) => {
    if (!messageText.trim() || !user) return;
    try {
      setSendingMessage(true);
      await messageApi.send(orderId, messageText.trim());
      setMessageText('');
      fetchMessages(orderId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при отправке');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleStatusChange = async (orderId: number, currentStatus: string) => {
    const nextStatus = statusFlow[currentStatus];
    if (!nextStatus) return;

    if (currentStatus === 'expertise') {
      setSelectedOrderId(orderId);
      setShowExpertiseModal(true);
      return;
    }

    if (nextStatus === 'completed') {
      setSelectedOrderId(orderId);
      setShowModal(true);
      return;
    }

    try {
      await orderApi.updateStatus(orderId, nextStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: nextStatus as Order['status'] } : o));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при изменении статуса');
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleDraftFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setDraft: (draft: { data: string; name: string }) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const problem = validateAttachment(file);
    if (problem) {
      setError(problem);
      return;
    }
    const data = await readFileAsBase64(file);
    setDraft({ data, name: file.name });
  };

  const resetExpertiseModal = () => {
    setShowExpertiseModal(false);
    setSelectedOrderId(null);
    setTestProgramDraft(null);
    setTypeDescriptionDraft(null);
    setExpertiseConclusion('');
  };

  const handleSubmitExpertise = async () => {
    if (!selectedOrderId) return;
    if (!testProgramDraft) { setError('Прикрепите проект программы испытаний'); return; }
    if (!typeDescriptionDraft) { setError('Прикрепите проект описания типа'); return; }
    if (!expertiseConclusion.trim()) { setError('Укажите экспертное заключение'); return; }

    // Оба черновика уходят одним запросом.
    const tooMuch = validateAttachmentsTotal([testProgramDraft.data, typeDescriptionDraft.data]);
    if (tooMuch) { setError(tooMuch); return; }

    try {
      setSubmittingExpertise(true);
      await orderApi.submitExpertise(selectedOrderId, {
        testProgramDraftFile: testProgramDraft.data,
        testProgramDraftFileName: testProgramDraft.name,
        typeDescriptionDraftFile: typeDescriptionDraft.data,
        typeDescriptionDraftFileName: typeDescriptionDraft.name,
        expertiseConclusion: expertiseConclusion.trim(),
      });
      setOrders(prev => prev.map(o => o.id === selectedOrderId ? { ...o, status: 'in_work' as Order['status'] } : o));
      resetExpertiseModal();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при отправке экспертизы');
    } finally {
      setSubmittingExpertise(false);
    }
  };

  const handleCompleteWithResult = async () => {
    if (!selectedOrderId || !user) return;
    try {
      setSubmitting(true);
      // metrologistId не шлём: автора бэкенд берёт из токена.
      await api.post('/results', { orderId: selectedOrderId, resultType });
      await orderApi.updateStatus(selectedOrderId, 'completed');
      setOrders(prev => prev.map(o => o.id === selectedOrderId ? { ...o, status: 'completed' as Order['status'] } : o));
      setShowModal(false);
      setSelectedOrderId(null);
      setResultType('certificate');
    } catch {
      setError('Ошибка при завершении заявки');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Загрузка очереди...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1.75rem' }}>
            Очередь заявок
          </h1>
          <p className="text-gray-500 text-sm mt-1" style={{ margin: '4px 0 0' }}>
            Управление заявками в системе
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
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/>
            </svg>
            <p className="text-gray-400">Нет заявок в системе</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {orders.map(order => {
              const sc = statusColors[order.status] || { bg: 'bg-gray-100', text: 'text-gray-500' };
              const canAdvance = !!statusFlow[order.status];
              return (
                <div key={order.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4">
                    <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                      <h3 className="font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1rem' }}>
                        #{order.orderNumber}
                      </h3>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${sc.bg} ${sc.text}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 bg-gray-50 rounded-xl p-3">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5" style={{ margin: '0 0 2px' }}>Клиент ID</p>
                        <p className="text-sm font-semibold text-gray-700" style={{ margin: 0 }}>#{order.clientId}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5" style={{ margin: '0 0 2px' }}>Лаборатория</p>
                        <p className="text-sm font-semibold text-gray-700" style={{ margin: 0 }}>#{order.labId}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5" style={{ margin: '0 0 2px' }}>Плановая дата</p>
                        <p className="text-sm font-semibold text-gray-700" style={{ margin: 0 }}>
                          {order.dueDate ? new Date(order.dueDate).toLocaleDateString('ru-RU') : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {canAdvance && (
                        <button onClick={() => handleStatusChange(order.id, order.status)}
                          className="px-4 py-2 bg-[#00B2FF] hover:bg-[#0095D9] text-white font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-1.5"
                          style={{ marginBottom: 0 }}>
                          Далее
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path d="m9 18 6-6-6-6"/>
                          </svg>
                        </button>
                      )}

                      <button onClick={() => downloadContract(order.id, order.orderNumber, setError)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-1.5"
                        style={{ marginBottom: 0 }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/>
                        </svg>
                        Договор
                      </button>

                      {order.status === 'completed' && (
                        <button onClick={() => downloadCertificate(order.id, order.orderNumber, setError, setDownloadingId)}
                          disabled={downloadingId === order.id}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-1.5"
                          style={{ marginBottom: 0 }}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          {downloadingId === order.id ? 'Загрузка...' : 'Сертификат'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="px-6 pb-4 border-t border-gray-50 pt-3">
                    <button onClick={() => handleOpenChat(order.id)}
                      className="flex items-center gap-2 text-sm font-medium text-[#0A2E5C] hover:text-[#00B2FF] transition-colors border-none bg-transparent cursor-pointer px-0"
                      style={{ marginBottom: 0 }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      {chatOpen === order.id ? 'Скрыть чат' : 'Переписка'}
                      {messages[order.id]?.length > 0 && (
                        <span className="px-1.5 py-0.5 text-xs bg-[#00B2FF] text-white rounded-full">
                          {messages[order.id].length}
                        </span>
                      )}
                    </button>

                    {chatOpen === order.id && (
                      <div className="mt-3">
                        <div className="bg-gray-50 rounded-xl p-3 mb-3 max-h-56 overflow-y-auto flex flex-col gap-2">
                          {!messages[order.id] || messages[order.id].length === 0 ? (
                            <p className="text-xs text-gray-400 text-center py-4">Сообщений пока нет</p>
                          ) : (
                            messages[order.id].map(msg => (
                              <div key={msg.id} className={`flex flex-col ${msg.senderId === user?.id ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                                  msg.senderId === user?.id
                                    ? 'bg-[#0A2E5C] text-white'
                                    : 'bg-white border border-gray-200 text-gray-800'
                                }`}>
                                  {msg.text}
                                </div>
                                <span className="text-xs text-gray-400 mt-1 px-1">
                                  {msg.senderRole === 'client' ? 'Клиент' : msg.senderRole === 'manager' ? 'Менеджер' : 'Метролог'} · {new Date(msg.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input type="text" value={messageText}
                            onChange={e => setMessageText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(order.id); } }}
                            placeholder="Напишите сообщение..."
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all"
                            style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                          <button onClick={() => handleSendMessage(order.id)}
                            disabled={sendingMessage || !messageText.trim()}
                            className="px-4 py-2.5 bg-[#00B2FF] hover:bg-[#0095D9] disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-medium rounded-xl border-none cursor-pointer text-sm transition-colors shrink-0"
                            style={{ marginBottom: 0 }}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
            <h2 className="font-bold text-[#0A2E5C] mb-6" style={{ margin: '0 0 24px', fontSize: '1.25rem' }}>
              Завершить заявку
            </h2>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Тип документа</label>
              <select value={resultType} onChange={e => setResultType(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm bg-white outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all cursor-pointer"
                style={{ fontFamily: 'inherit', marginBottom: 0 }}>
                <option value="certificate">Сертификат</option>
                <option value="protocol">Протокол</option>
                <option value="report">Отчёт</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCompleteWithResult} disabled={submitting}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors flex items-center justify-center gap-2"
                style={{ marginBottom: 0 }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="m9 11 3 3L22 4"/>
                </svg>
                {submitting ? 'Сохранение...' : 'Завершить'}
              </button>
              <button onClick={() => { setShowModal(false); setSelectedOrderId(null); }}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors"
                style={{ marginBottom: 0 }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {showExpertiseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
            <h2 className="font-bold text-[#0A2E5C] mb-6" style={{ margin: '0 0 24px', fontSize: '1.25rem' }}>
              Завершить экспертизу
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Проект программы испытаний *</label>
              <input type="file" accept={ATTACHMENT_ACCEPT}
                onChange={e => handleDraftFileChange(e, setTestProgramDraft)}
                className="w-full text-sm text-gray-700" style={{ marginBottom: 0 }} />
              {testProgramDraft && (
                <p className="text-xs text-green-600 mt-1" style={{ margin: '4px 0 0' }}>{testProgramDraft.name}</p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Проект описания типа *</label>
              <input type="file" accept={ATTACHMENT_ACCEPT}
                onChange={e => handleDraftFileChange(e, setTypeDescriptionDraft)}
                className="w-full text-sm text-gray-700" style={{ marginBottom: 0 }} />
              {typeDescriptionDraft && (
                <p className="text-xs text-green-600 mt-1" style={{ margin: '4px 0 0' }}>{typeDescriptionDraft.name}</p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Экспертное заключение *</label>
              <textarea value={expertiseConclusion} onChange={e => setExpertiseConclusion(e.target.value)}
                placeholder="Результаты экспертизы технической документации..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all resize-none"
                style={{ fontFamily: 'inherit', marginBottom: 0 }} />
            </div>

            <div className="flex gap-3">
              <button onClick={handleSubmitExpertise} disabled={submittingExpertise}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors flex items-center justify-center gap-2"
                style={{ marginBottom: 0 }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="m9 11 3 3L22 4"/>
                </svg>
                {submittingExpertise ? 'Сохранение...' : 'Завершить экспертизу'}
              </button>
              <button onClick={resetExpertiseModal}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors"
                style={{ marginBottom: 0 }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}