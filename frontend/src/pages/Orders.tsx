import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { orderApi, contractApi, serviceApi, pdfApi, messageApi } from '../services/api';
import api from '../services/api';
import type { Order, Service, Laboratory, OrderItem, Message } from '../types';
import { downloadCertificate } from '../utils/download';

export default function Orders() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState<number | null>(null);
  const [sendingInvoice, setSendingInvoice] = useState<number | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState<number | null>(null);
  const [uploadingContract, setUploadingContract] = useState<number | null>(null);
  const [notifyingDirector, setNotifyingDirector] = useState<number | null>(null);
  const [directorNotified, setDirectorNotified] = useState<Set<number>>(new Set());
  const [messages, setMessages] = useState<Record<number, Message[]>>({});
  const [chatOpen, setChatOpen] = useState<number | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const [contractData, setContractData] = useState<Record<number, {
    clientSigned: boolean;
    directorSigned: boolean;
    approverSigned: boolean;
    financierSigned: boolean;
    genDirectorSigned: boolean;
    contractFileName?: string;
    registrationNumber?: string;
    status: string;
    downloaded: boolean;
  }>>({});

  // Модалка редактирования — менеджер
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState({ serviceId: '', labId: '',  dueDate: '', clientComment: '' });
  const [editLoading, setEditLoading] = useState(false);

  // Модалка возврата на доработку — менеджер
  const [returnOrder, setReturnOrder] = useState<Order | null>(null);
  const [returnComment, setReturnComment] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);

  // Модалка исправления заявки — клиент при revision
  const [resubmitOrder, setResubmitOrder] = useState<Order | null>(null);
  const [resubmitItems, setResubmitItems] = useState<Array<{
    id?: number; deviceType: string; model: string; serialNumber: string; quantity: number;
  }>>([]);
  const [resubmitForm, setResubmitForm] = useState({ serviceId: '', labId: '', dueDate: '', clientComment: '' });
  const [resubmitLoading, setResubmitLoading] = useState(false);

  const statusLabels: Record<string, string> = {
    pending_contract:  'Ожидает договора',
    revision:          'На доработке',
    awaiting_approval: 'На согласовании',
    awaiting_director: 'У директора',
    awaiting_payment:  'Ожидает оплаты',
    pending_delivery:  'Оплата получена',
    awaiting_delivery: 'Ожидает доставки',
    received_in_lab:   'Принято в лаб',
    expertise:         'Экспертиза документации',
    in_work:           'В работе',
    under_review:      'На проверке',
    completed:         'Завершено',
    cancelled:         'Отменено',
    annulled:          'Аннулировано',
    terminated:        'Расторгнуто',
  };

  const statusColors: Record<string, { bg: string; text: string }> = {
    pending_contract:  { bg: 'bg-slate-100',  text: 'text-slate-600' },
    revision:          { bg: 'bg-orange-100', text: 'text-orange-700' },
    awaiting_approval: { bg: 'bg-blue-100',   text: 'text-blue-700' },
    awaiting_director: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    awaiting_payment:  { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    pending_delivery:  { bg: 'bg-lime-100',   text: 'text-lime-700' },
    awaiting_delivery: { bg: 'bg-amber-100',  text: 'text-amber-700' },
    received_in_lab:   { bg: 'bg-purple-100', text: 'text-purple-700' },
    expertise:         { bg: 'bg-violet-100', text: 'text-violet-700' },
    in_work:           { bg: 'bg-pink-100',   text: 'text-pink-700' },
    under_review:      { bg: 'bg-orange-100', text: 'text-orange-700' },
    completed:         { bg: 'bg-green-100',  text: 'text-green-700' },
    cancelled:         { bg: 'bg-gray-100',   text: 'text-gray-500' },
    annulled:          { bg: 'bg-red-100',    text: 'text-red-600' },
    terminated:        { bg: 'bg-red-100',    text: 'text-red-600' },
  };

  useEffect(() => {
    if (orders.length === 0) return;
    orders.forEach(order => {
      contractApi.getByOrderId(order.id)
        .then(res => {
          setContractData(prev => ({
            ...prev,
            [order.id]: {
              clientSigned: res.data.clientSigned,
              directorSigned: res.data.directorSigned,
              approverSigned: res.data.approverSigned,
              financierSigned: res.data.financierSigned,
              genDirectorSigned: res.data.genDirectorSigned,
              contractFileName: res.data.contractFileName,
              registrationNumber: res.data.registrationNumber,
              status: res.data.status,
              downloaded: prev[order.id]?.downloaded || false,
            }
          }));
        })
        .catch(() => {});
    });
  }, [orders]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const response = user?.role === 'manager'
        ? await orderApi.getAll()
        : await orderApi.getMyOrders(user?.id || 0);
      setOrders(response.data);
    } catch {
      setError('Ошибка при загрузке заявок');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    serviceApi.getAll().then(res => setServices(res.data)).catch(() => {});
    api.get('/laboratories').then(res => setLaboratories(res.data)).catch(() => {});
  }, []);

  // ─── Утилита скачивания blob ──────────────────────────────────────────
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // ─── Договор ─────────────────────────────────────────────────────────
  const handleContract = async (orderId: number) => {
    try {
      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';
      const response = await fetch(`${baseUrl}/contracts/${orderId}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Ошибка загрузки');
      const blob = await response.blob();
      downloadBlob(blob, `contract_${orderId}.pdf`);
      setContractData(prev => ({
        ...prev,
        [orderId]: { ...prev[orderId], downloaded: true }
      }));
    } catch {
      setError('Ошибка при скачивании договора');
    }
  };

  // ─── Счёт ─────────────────────────────────────────────────────────────
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

  // Менеджер отмечает что счёт отправлен клиенту
  const handleSendInvoice = async (orderId: number) => {
    try {
      setSendingInvoice(orderId);
      await orderApi.sendInvoice(orderId);
      setOrders(prev => prev.map(o =>
        o.id === orderId ? { ...o, invoiceSent: true } : o
      ));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при отправке счёта');
    } finally {
      setSendingInvoice(null);
    }
  };

  // ─── Договорные действия ─────────────────────────────────────────────
  const handleUploadContract = async (order: Order, file: File) => {
    const allowed = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) {
      setError('Поддерживаются только PDF и Word документы');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Файл слишком большой. Максимум 7MB');
      return;
    }
    try {
      setUploadingContract(order.id);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await contractApi.uploadContract(order.id, base64, file.name);
      await fetchOrders();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при загрузке договора');
    } finally {
      setUploadingContract(null);
    }
  };


  const handleNotifyDirector = async (orderId: number) => {
    try {
      setNotifyingDirector(orderId);
      await orderApi.notifyDirector(orderId);
      setDirectorNotified(prev => new Set(prev).add(orderId));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при отправке уведомления');
    } finally {
      setNotifyingDirector(null);
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
      await messageApi.send(orderId, user.id, messageText.trim());
      setMessageText('');
      fetchMessages(orderId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при отправке');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSubmit = async (orderId: number) => {
    try {
      await contractApi.submit(orderId);
      setContractData(prev => ({
        ...prev,
        [orderId]: { ...prev[orderId], status: 'pending_approval' }
      }));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при отправке на согласование');
    }
  };

  const handleClientSign = async (orderId: number) => {
    if (!window.confirm('Подписать договор ЭЦП?')) return;
    try {
      await contractApi.signByClient(orderId, user?.id || 0);
      setContractData(prev => ({ ...prev, [orderId]: { ...prev[orderId], clientSigned: true } }));
    } catch {
      setError('Ошибка при подписании');
    }
  };

  // ─── Менеджер: редактирование ─────────────────────────────────────────
  const handleOpenEdit = (order: Order) => {
    setEditOrder(order);
    setEditForm({
      serviceId: order.serviceId.toString(),
      labId: order.labId.toString(),
      
      dueDate: order.dueDate || '',
      clientComment: order.clientComment || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editOrder) return;
    try {
      setEditLoading(true);
      await orderApi.update(editOrder.id, {
        serviceId: parseInt(editForm.serviceId),
        labId: parseInt(editForm.labId),
        
        dueDate: editForm.dueDate,
        clientComment: editForm.clientComment,
      });
      setEditOrder(null);
      await fetchOrders();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при редактировании');
    } finally {
      setEditLoading(false);
    }
  };

  // ─── Менеджер: возврат на доработку ──────────────────────────────────
  const handleReturnToRevision = async () => {
    if (!returnOrder) return;
    if (!returnComment.trim()) { setError('Укажите причину возврата'); return; }
    try {
      setReturnLoading(true);
      await orderApi.returnToRevision(returnOrder.id, returnComment.trim());
      setReturnOrder(null);
      setReturnComment('');
      await fetchOrders();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при возврате заявки');
    } finally {
      setReturnLoading(false);
    }
  };

  // ─── Клиент: открыть модалку исправления ─────────────────────────────
  const handleOpenResubmit = async (order: Order) => {
    setResubmitOrder(order);
    setResubmitForm({
      serviceId: order.serviceId.toString(),
      labId: order.labId.toString(),
      dueDate: order.dueDate || '',
      clientComment: order.clientComment || '',
    });
    try {
      const res = await api.get(`/orders/${order.id}/items`);
      setResubmitItems(res.data.map((item: OrderItem) => ({
        id: item.id,
        deviceType: item.deviceType,
        model: item.model || '',
        serialNumber: item.serialNumber,
        quantity: item.quantity,
        
      })));
    } catch {
      setResubmitItems([{ deviceType: '', model: '', serialNumber: '', quantity: 1 }]);
    }
  };

  const handleResubmitItemChange = (index: number, field: string, value: string | number) => {
    setResubmitItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const handleAddResubmitItem = () => {
    setResubmitItems(prev => [...prev, { deviceType: '', model: '', serialNumber: '', quantity: 1 }]);
  };

  const handleRemoveResubmitItem = (index: number) => {
    if (resubmitItems.length === 1) return;
    setResubmitItems(prev => prev.filter((_, i) => i !== index));
  };

  // ─── Клиент: отправить исправленную заявку ────────────────────────────
  const handleResubmit = async () => {
    if (!resubmitOrder) return;
    try {
      setResubmitLoading(true);
      await orderApi.resubmit(resubmitOrder.id, {
        serviceId: parseInt(resubmitForm.serviceId),
        labId: parseInt(resubmitForm.labId),
        dueDate: resubmitForm.dueDate,
        clientComment: resubmitForm.clientComment,
        orderItems: resubmitItems.map(item => ({
          deviceType: item.deviceType,
          model: item.model,
          serialNumber: item.serialNumber,
          quantity: item.quantity,
          
        })),
      });
      setResubmitOrder(null);
      await fetchOrders();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при отправке заявки');
    } finally {
      setResubmitLoading(false);
    }
  };

  // ─── Клиент: загрузить чек об оплате ───────────────────────
  const handleUploadReceipt = async (order: Order, file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError('Файл слишком большой. Максимум 5MB');
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setError('Поддерживаются только JPG, PNG, WEBP и PDF');
      return;
    }
    try {
      setUploadingReceipt(order.id);
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await orderApi.uploadReceipt(order.id, base64, file.name);
      setOrders(prev => prev.map(o =>
        o.id === order.id
          ? { ...o, paymentReceiptName: file.name, receiptUploadedAt: new Date().toISOString() }
          : o
      ));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при загрузке чека');
    } finally {
      setUploadingReceipt(null);
    }
  };

  const filteredOrders = filterStatus ? orders.filter(o => o.status === filterStatus) : orders;
  const formatDate = (dateString?: string) =>
    dateString ? new Date(dateString).toLocaleDateString('ru-RU') : 'Не указана';
  const getStatusClass = (status: string) =>
    statusColors[status] || { bg: 'bg-gray-100', text: 'text-gray-500' };

  const inputClass = "w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm bg-white outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all";
  const selectClass = "w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm bg-white outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all cursor-pointer";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          Загрузка заявок...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1.75rem' }}>
            {user?.role === 'manager' ? 'Все заявки' : 'Мои заявки'}
          </h1>
          <p className="text-gray-500 text-sm mt-1" style={{ margin: '4px 0 0' }}>
            Управляйте заявками на метрологические услуги
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-6 text-red-600 text-sm">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
            </svg>
            {error}
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600 border-none bg-transparent cursor-pointer text-lg leading-none" style={{ marginBottom: 0 }}>×</button>
          </div>
        )}

        <div className="flex flex-wrap gap-4 mb-6 items-start">
          <div className="flex gap-4 flex-1 flex-wrap">
            {[
              { label: 'Всего', value: orders.length },
              { label: 'В процессе', value: orders.filter(o => !['completed','cancelled','annulled','terminated'].includes(o.status)).length },
              { label: 'Завершено', value: orders.filter(o => o.status === 'completed').length },
            ].map(stat => (
              <div key={stat.label} className="bg-white border border-gray-100 rounded-xl px-6 py-4 shadow-sm text-center min-w-[120px]">
                <p className="text-xs text-gray-400 mb-1" style={{ margin: '0 0 4px' }}>{stat.label}</p>
                <p className="text-2xl font-bold text-[#0A2E5C]" style={{ margin: 0 }}>{stat.value}</p>
              </div>
            ))}
          </div>
          {(user?.role === 'client' || user?.role === 'manager') && (
            <button
              onClick={() => navigate('/create-order')}
              className="flex items-center gap-2 px-5 py-3 bg-[#00B2FF] hover:bg-[#0095D9] text-white font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors"
              style={{ marginBottom: 0 }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
              </svg>
              Новая заявка
            </button>
          )}
        </div>

        <div className="mb-6">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all cursor-pointer"
            style={{ fontFamily: 'inherit', marginBottom: 0 }}
          >
            <option value="">Все статусы</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-16 text-center shadow-sm">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/>
            </svg>
            <p className="text-gray-400 mb-4" style={{ margin: '0 0 16px' }}>Нет заявок</p>
            {user?.role === 'client' && (
              <button onClick={() => navigate('/create-order')}
                className="px-6 py-3 bg-[#00B2FF] hover:bg-[#0095D9] text-white font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors"
                style={{ marginBottom: 0 }}>
                Создать первую заявку
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredOrders.map(order => {
              const sc = getStatusClass(order.status);
              const cd = contractData[order.id];
              return (
                <div key={order.id}
                  className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-[#00B2FF]/30 transition-all">

                  {/* Заголовок */}
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1rem' }}>
                        {user?.role === 'client' ? `Исх. № ${order.orderNumber}` : `Заявка #${order.orderNumber}`}
                      </h3>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${sc.bg} ${sc.text}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                      {/* Бейдж "Счёт отправлен" для менеджера */}
                      {user?.role === 'manager' && order.invoiceSent && (
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path d="m9 11 3 3L22 4"/>
                          </svg>
                          Счёт отправлен
                        </span>
                      )}
                    </div>
                    {user?.role === 'manager' && (
                      <button onClick={() => handleOpenEdit(order)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-lg border-none cursor-pointer text-xs transition-colors"
                        style={{ marginBottom: 0 }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Редактировать
                      </button>
                    )}
                  </div>

                  {/* Детали */}
                  <div className="bg-gray-50 rounded-xl p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5" style={{ margin: '0 0 2px' }}>Плановая дата</p>
                      <p className="text-sm font-semibold text-gray-700" style={{ margin: 0 }}>{formatDate(order.dueDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5" style={{ margin: '0 0 2px' }}>Лаборатория</p>
                      <p className="text-sm font-semibold text-gray-700" style={{ margin: 0 }}>#{order.labId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5" style={{ margin: '0 0 2px' }}>Договор</p>
                      <span className="text-xs font-semibold text-gray-600">
                        {cd ? (
                          cd.genDirectorSigned ? (
                            <span className="text-green-700">
                              Подписан{cd.registrationNumber ? ` · ${cd.registrationNumber}` : ''}
                            </span>
                          ) :
                          cd.clientSigned ? 'Ожидает ген.директора' :
                          cd.approverSigned && cd.financierSigned && cd.directorSigned ? 'Ожидает клиента' :
                          cd.status === 'pending_approval' ? 'На согласовании' :
                          cd.contractFileName ? 'Файл загружен' : 'Черновик'
                        ) : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Комментарий менеджера — клиент видит при revision */}
                  {user?.role === 'client' && order.status === 'revision' && order.managerComment && (
                    <div className="flex gap-3 p-4 mb-4 bg-orange-50 border border-orange-200 rounded-xl">
                      <svg className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      <div>
                        <p className="text-xs font-semibold text-orange-700 mb-1" style={{ margin: '0 0 4px' }}>Комментарий менеджера</p>
                        <p className="text-sm text-orange-800" style={{ margin: 0 }}>{order.managerComment}</p>
                      </div>
                    </div>
                  )}

                  {user?.role === 'client' && order.status === 'awaiting_payment' && (
                    <div className="mb-4">
                      {order.price == null ? (
                        <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                          <svg className="w-5 h-5 text-yellow-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                          </svg>
                          <p className="text-sm text-yellow-700" style={{ margin: 0 }}>
                            Ожидайте счёт от финансиста. После объявления суммы вы сможете загрузить чек.
                          </p>
                        </div>
                      ) : !order.invoiceSent ? (
                        <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                          <svg className="w-5 h-5 text-yellow-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
                          </svg>
                          <div>
                            <p className="text-sm font-semibold text-yellow-700" style={{ margin: '0 0 2px' }}>
                              Счёт на оплату: {order.price?.toLocaleString()} ₸
                            </p>
                            <p className="text-xs text-yellow-600" style={{ margin: 0 }}>
                              Ожидайте когда менеджер пришлёт вам счёт с сопроводительным письмом.
                            </p>
                          </div>
                        </div>
                      ) : order.paymentReceiptName ? (
                        <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                          <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-green-700" style={{ margin: 0 }}>Чек загружен</p>
                            <p className="text-xs text-green-600 truncate" style={{ margin: 0 }}>{order.paymentReceiptName}</p>
                          </div>
                          <label className="text-xs text-green-600 hover:text-green-800 cursor-pointer font-medium underline">
                            Заменить
                            <input type="file" accept="image/*,.pdf" className="hidden"
                              onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadReceipt(order, f); e.target.value = ''; }} />
                          </label>
                        </div>
                      ) : (
                        <label className={`flex items-center gap-2 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                          uploadingReceipt === order.id
                            ? 'border-gray-200 bg-gray-50 text-gray-400'
                            : 'border-[#00B2FF]/40 hover:border-[#00B2FF] hover:bg-blue-50/30 text-[#00B2FF]'
                        }`}>
                          {uploadingReceipt === order.id ? (
                            <>
                              <svg className="w-4 h-4 animate-spin shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                              </svg>
                              <span className="text-sm">Загрузка...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                              </svg>
                              <span className="text-sm font-medium">Прикрепить чек об оплате</span>
                              <span className="text-xs opacity-60 ml-auto">JPG, PNG, PDF до 5MB</span>
                            </>
                          )}
                          <input type="file" accept="image/*,.pdf" className="hidden" disabled={uploadingReceipt === order.id}
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadReceipt(order, f); e.target.value = ''; }} />
                        </label>
                      )}
                    </div>
                  )}

                  {/* Кнопки */}
                  <div className="flex flex-wrap gap-2">

                    {/* Клиент: отменить */}
                    {user?.role === 'client' && ['pending_contract', 'revision', 'awaiting_payment'].includes(order.status) && (
                      <button
                        onClick={async () => {
                          if (!window.confirm('Отменить заявку?')) return;
                          try {
                            await orderApi.updateStatus(order.id, 'cancelled');
                            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'cancelled' as Order['status'] } : o));
                          } catch { setError('Ошибка при отмене'); }
                        }}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-lg border-none cursor-pointer text-sm transition-colors"
                        style={{ marginBottom: 0 }}>
                        Отменить
                      </button>
                    )}

                    {/* Клиент: исправить заявку при revision */}
                    {user?.role === 'client' && order.status === 'revision' && (
                      <button
                        onClick={() => handleOpenResubmit(order)}
                        className="px-4 py-2 bg-[#0A2E5C] hover:bg-[#0d3a73] text-white font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-2"
                        style={{ marginBottom: 0 }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Исправить и отправить
                      </button>
                    )}

                    {/* Клиент: скачать счёт — только после отправки менеджером */}
                    {user?.role === 'client' && order.status === 'awaiting_payment' && order.invoiceSent && (
                      <button
                        onClick={() => handleDownloadInvoice(order)}
                        disabled={downloadingInvoice === order.id}
                        className="px-4 py-2 bg-[#0A2E5C] hover:bg-[#0d3a73] disabled:bg-gray-200 text-white font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-2"
                        style={{ marginBottom: 0 }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/>
                          <path d="M14 2v5a1 1 0 0 0 1 1h5"/>
                        </svg>
                        {downloadingInvoice === order.id ? 'Загрузка...' : 'Скачать счёт'}
                      </button>
                    )}

                    {/* Менеджер: создать договор */}
                    {user?.role === 'manager' && order.status === 'pending_contract' && (
                      <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer text-sm font-medium transition-colors border-none ${
                        uploadingContract === order.id
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-[#0A2E5C] hover:bg-[#0d3a73] text-white'
                      }`} style={{ marginBottom: 0 }}>
                        {uploadingContract === order.id ? (
                          <>
                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                            </svg>
                            Загрузка...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                            </svg>
                            Загрузить договор
                          </>
                        )}
                        <input type="file" accept=".pdf,.doc,.docx" className="hidden"
                          disabled={uploadingContract === order.id}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadContract(order, f); e.target.value = ''; }} />
                      </label>
                    )}

                      {user?.role === 'manager' && order.status === 'awaiting_approval' && cd?.contractFileName && (
                      <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path d="m9 11 3 3L22 4"/>
                        </svg>
                        {cd.contractFileName}
                      </span>
                    )}

                    {/* Менеджер: вернуть на доработку */}
                    {user?.role === 'manager' && order.status === 'pending_contract' && (
                      <button onClick={() => { setReturnOrder(order); setReturnComment(''); }}
                        className="px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 font-medium rounded-lg border border-orange-200 cursor-pointer text-sm transition-colors flex items-center gap-2"
                        style={{ marginBottom: 0 }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>
                        </svg>
                        Вернуть на доработку
                      </button>
                    )}

                    {/* Менеджер: отправить на согласование */}
                    {user?.role === 'manager' && order.status === 'awaiting_approval' && cd?.status === 'draft' && (
                      <button onClick={() => handleSubmit(order.id)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg border-none cursor-pointer text-sm transition-colors"
                        style={{ marginBottom: 0 }}>
                        Отправить на согласование
                      </button>
                    )}

                    {/* Менеджер: скачать счёт */}
                    {user?.role === 'manager' && order.status === 'awaiting_payment' && (
                      <button
                        onClick={() => handleDownloadInvoice(order)}
                        disabled={downloadingInvoice === order.id}
                        className="px-4 py-2 bg-[#0A2E5C] hover:bg-[#0d3a73] disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-2"
                        style={{ marginBottom: 0 }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/>
                          <path d="M14 2v5a1 1 0 0 0 1 1h5"/>
                        </svg>
                        {downloadingInvoice === order.id ? 'Генерация...' : 'Скачать счёт'}
                      </button>
                    )}

                    {/* Менеджер: отправить счёт клиенту */}
                    {user?.role === 'manager' && order.status === 'awaiting_payment' && (
                      <button
                        onClick={() => handleSendInvoice(order.id)}
                        disabled={sendingInvoice === order.id || order.invoiceSent}
                        className={`px-4 py-2 font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-2 ${
                          order.invoiceSent
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                        style={{ marginBottom: 0 }}>
                        {order.invoiceSent ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path d="m9 11 3 3L22 4"/>
                            </svg>
                            Счёт отправлен
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
                            </svg>
                            {sendingInvoice === order.id ? 'Отправка...' : 'Отправить счёт клиенту'}
                          </>
                        )}
                      </button>
                    )}

                    {user?.role === 'manager' && order.status === 'pending_delivery' && (
                      <button
                        onClick={() => handleNotifyDirector(order.id)}
                        disabled={notifyingDirector === order.id || directorNotified.has(order.id)}
                        className={`px-4 py-2 font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-2 ${
                          directorNotified.has(order.id)
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                        style={{ marginBottom: 0 }}>
                        {directorNotified.has(order.id) ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path d="m9 11 3 3L22 4"/>
                            </svg>
                            Руководитель уведомлён
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                            </svg>
                            {notifyingDirector === order.id ? 'Отправка...' : 'Уведомить руководителя'}
                          </>
                        )}
                      </button>
                    )}

                    {!['pending_contract', 'revision'].includes(order.status) && (
                      <button onClick={() => handleContract(order.id)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-2"
                        style={{ marginBottom: 0 }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/>
                          <path d="M14 2v5a1 1 0 0 0 1 1h5"/>
                        </svg>
                        Договор
                      </button>
                    )}

                    {/* Клиент: подписать ЭЦП */}
                    {user?.role === 'client' && order.status === 'awaiting_approval' && cd?.approverSigned && cd?.financierSigned && cd?.directorSigned && !cd?.clientSigned && (
                      <button onClick={() => handleClientSign(order.id)}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-2"
                        style={{ marginBottom: 0 }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Подписать ЭЦП
                      </button>
                    )}

                    {/* Клиент: индикатор подписи */}
                    {user?.role === 'client' && cd?.clientSigned && (
                      <span className="flex items-center gap-1 text-sm text-emerald-600 font-medium px-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path d="m9 11 3 3L22 4"/>
                        </svg>
                        Вы подписали
                      </span>
                    )}

                    {/* Сертификат */}
                    {order.status === 'completed' && (
                      <button
                        onClick={() => downloadCertificate(order.id, order.orderNumber, setError, setDownloadingId)}
                        disabled={downloadingId === order.id}
                        className="px-4 py-2 bg-[#00B2FF] hover:bg-[#0095D9] text-white font-medium rounded-lg border-none cursor-pointer text-sm transition-colors flex items-center gap-2"
                        style={{ marginBottom: 0 }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        {downloadingId === order.id ? 'Загрузка...' : 'Сертификат'}
                      </button>
                    )}
                  </div>

                  {/* Чат клиент ↔ менеджер */}
                  {(user?.role === 'client' || user?.role === 'manager') && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <button
                        onClick={() => handleOpenChat(order.id)}
                        className="flex items-center gap-2 text-sm font-medium text-[#0A2E5C] hover:text-[#00B2FF] transition-colors border-none bg-transparent cursor-pointer px-0"
                        style={{ marginBottom: 0 }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        {chatOpen === order.id ? 'Скрыть чат' : 'Открыть чат'}
                        {messages[order.id]?.length > 0 && (
                          <span className="px-1.5 py-0.5 text-xs bg-[#00B2FF] text-white rounded-full">
                            {messages[order.id].length}
                          </span>
                        )}
                      </button>

                      {chatOpen === order.id && (
                        <div className="mt-3">
                          <div className="bg-gray-50 rounded-xl p-3 mb-3 max-h-64 overflow-y-auto flex flex-col gap-2">
                            {!messages[order.id] || messages[order.id].length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-4">Сообщений пока нет</p>
                            ) : (
                              messages[order.id].map(msg => {
                                const isMe = msg.senderId === user?.id;
                                return (
                                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                                      isMe
                                        ? 'bg-[#0A2E5C] text-white'
                                        : 'bg-white border border-gray-200 text-gray-800'
                                    }`}>
                                      {msg.text}
                                    </div>
                                    <span className="text-xs text-gray-400 mt-1 px-1">
                                      {msg.senderRole === 'client' ? 'Клиент' : 'Менеджер'} · {new Date(msg.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={messageText}
                              onChange={e => setMessageText(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(order.id); } }}
                              placeholder="Напишите сообщение..."
                              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all"
                              style={{ fontFamily: 'inherit', marginBottom: 0 }}
                            />
                            <button
                              onClick={() => handleSendMessage(order.id)}
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
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Модалка редактирования (менеджер) ──────────────────────────── */}
      {editOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
            <h2 className="font-bold text-[#0A2E5C] mb-6" style={{ margin: '0 0 24px', fontSize: '1.25rem' }}>
              Редактировать заявку #{editOrder.orderNumber}
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Услуга</label>
                <select value={editForm.serviceId} onChange={e => setEditForm(p => ({ ...p, serviceId: e.target.value }))}
                  className={selectClass} style={{ fontFamily: 'inherit', marginBottom: 0 }}>
                  <option value="">— Выберите услугу —</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Плановая дата сдачи</label>
                <input type="date" value={editForm.dueDate} onChange={e => setEditForm(p => ({ ...p, dueDate: e.target.value }))}
                  className={inputClass} style={{ fontFamily: 'inherit', marginBottom: 0 }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Комментарий</label>
                <textarea value={editForm.clientComment} onChange={e => setEditForm(p => ({ ...p, clientComment: e.target.value }))}
                  rows={3} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm bg-white outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all resize-none"
                  style={{ fontFamily: 'inherit', marginBottom: 0 }} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveEdit} disabled={editLoading}
                className="flex-1 py-3 bg-[#00B2FF] hover:bg-[#0095D9] text-white font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors"
                style={{ marginBottom: 0 }}>
                {editLoading ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button onClick={() => setEditOrder(null)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors"
                style={{ marginBottom: 0 }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Модалка возврата на доработку (менеджер) ───────────────────── */}
      {returnOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>
                </svg>
              </div>
              <h2 className="font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1.25rem' }}>Вернуть на доработку</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6" style={{ margin: '4px 0 24px' }}>
              Заявка #{returnOrder.orderNumber} будет возвращена клиенту. Укажите причину.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Причина возврата</label>
              <textarea value={returnComment} onChange={e => setReturnComment(e.target.value)} rows={4}
                placeholder="Опишите что нужно исправить или дополнить..."
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm bg-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/10 transition-all resize-none"
                style={{ fontFamily: 'inherit', marginBottom: 0 }} autoFocus />
              <p className="text-xs text-gray-400 mt-1.5" style={{ margin: '6px 0 0' }}>Клиент увидит этот комментарий</p>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleReturnToRevision} disabled={returnLoading || !returnComment.trim()}
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-200 disabled:cursor-not-allowed text-white font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors"
                style={{ marginBottom: 0 }}>
                {returnLoading ? 'Отправка...' : 'Вернуть на доработку'}
              </button>
              <button onClick={() => { setReturnOrder(null); setReturnComment(''); }}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors"
                style={{ marginBottom: 0 }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Модалка исправления заявки (клиент при revision) ───────────── */}
      {resubmitOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl my-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#0A2E5C]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </div>
              <h2 className="font-bold text-[#0A2E5C]" style={{ margin: 0, fontSize: '1.25rem' }}>
                Исправить заявку #{resubmitOrder.orderNumber}
              </h2>
            </div>
            <p className="text-sm text-gray-500 mb-6" style={{ margin: '4px 0 24px' }}>
              Внесите исправления и отправьте заявку менеджеру повторно.
            </p>

            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Услуга</label>
                <select value={resubmitForm.serviceId} onChange={e => setResubmitForm(p => ({ ...p, serviceId: e.target.value }))}
                  className={selectClass} style={{ fontFamily: 'inherit', marginBottom: 0 }}>
                  <option value="">— Выберите услугу —</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Лаборатория</label>
                <select value={resubmitForm.labId} onChange={e => setResubmitForm(p => ({ ...p, labId: e.target.value }))}
                  className={selectClass} style={{ fontFamily: 'inherit', marginBottom: 0 }}>
                  <option value="">— Выберите лабораторию —</option>
                  {laboratories.map(lab => <option key={lab.id} value={lab.id}>{lab.name} {lab.city ? `(${lab.city})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Плановая дата сдачи</label>
                <input type="date" value={resubmitForm.dueDate} onChange={e => setResubmitForm(p => ({ ...p, dueDate: e.target.value }))}
                  className={inputClass} style={{ fontFamily: 'inherit', marginBottom: 0 }} />
              </div>

              {/* Приборы */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Приборы</label>
                  <button onClick={handleAddResubmitItem}
                    className="flex items-center gap-1 text-xs text-[#00B2FF] hover:text-[#0095D9] border-none bg-transparent cursor-pointer font-medium"
                    style={{ marginBottom: 0 }}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
                    </svg>
                    Добавить прибор
                  </button>
                </div>
                <div className="flex flex-col gap-3">
                  {resubmitItems.map((item, index) => (
                    <div key={index} className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-500">Прибор {index + 1}</span>
                        {resubmitItems.length > 1 && (
                          <button onClick={() => handleRemoveResubmitItem(index)}
                            className="text-red-400 hover:text-red-600 border-none bg-transparent cursor-pointer text-xs"
                            style={{ marginBottom: 0 }}>Удалить</button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Тип прибора *</label>
                          <input type="text" value={item.deviceType}
                            onChange={e => handleResubmitItemChange(index, 'deviceType', e.target.value)}
                            placeholder="Манометр, Амперметр..." className={inputClass}
                            style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Модель</label>
                          <input type="text" value={item.model}
                            onChange={e => handleResubmitItemChange(index, 'model', e.target.value)}
                            placeholder="Модель" className={inputClass}
                            style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Серийный номер *</label>
                          <input type="text" value={item.serialNumber}
                            onChange={e => handleResubmitItemChange(index, 'serialNumber', e.target.value)}
                            placeholder="Серийный номер" className={inputClass}
                            style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Количество *</label>
                          <input type="number" min={1} value={item.quantity}
                            onChange={e => handleResubmitItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                            className={inputClass} style={{ fontFamily: 'inherit', marginBottom: 0 }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Комментарий</label>
                <textarea value={resubmitForm.clientComment}
                  onChange={e => setResubmitForm(p => ({ ...p, clientComment: e.target.value }))}
                  rows={3} placeholder="Дополнительные пожелания..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm bg-white outline-none focus:border-[#00B2FF] focus:ring-2 focus:ring-[#00B2FF]/10 transition-all resize-none"
                  style={{ fontFamily: 'inherit', marginBottom: 0 }} />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleResubmit} disabled={resubmitLoading}
                className="flex-1 py-3 bg-[#00B2FF] hover:bg-[#0095D9] disabled:bg-blue-200 disabled:cursor-not-allowed text-white font-semibold rounded-xl border-none cursor-pointer text-sm transition-colors"
                style={{ marginBottom: 0 }}>
                {resubmitLoading ? 'Отправка...' : 'Отправить менеджеру'}
              </button>
              <button onClick={() => setResubmitOrder(null)}
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