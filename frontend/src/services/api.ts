import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { useAuthStore } from '../store/authStore';
import type { AuthResponse, LoginRequest, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest, CustomFieldDef } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (config.url && !config.url.endsWith('/')) config.url += '/';
    return config;
  },
  (error) => Promise.reject(error)
);

// Один разлогин на страницу: на маунте уходит несколько запросов сразу, и с
// протухшим токеном каждый ответ 401 иначе дёргает logout и присваивает
// location.href отдельно. Флаг живёт до перезагрузки — редирект её и делает.
let sessionExpiredHandled = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Всё под /auth/ вызывает неаутентифицированный пользователь, и 401 там
    // значит "неверные учётные данные", а не "сессия кончилась" — такую ошибку
    // показывает сама форма, разлогинивать и уводить с неё нельзя.
    const isAuthRequest = (error.config?.url ?? '').startsWith('/auth/');

    // Признак — состояние стора, а не наличие заголовка в запросе: выйдя в
    // соседней вкладке, пользователь оставляет эту с пустым localStorage (то
    // есть запрос уходит без заголовка), но сессию тут всё равно надо закрыть.
    // Аноним на публичной главной — она тоже тянет каталог — в стор не залогинен,
    // и для него 401 значит "нужна авторизация", а не "сессия истекла".
    const hadSession = useAuthStore.getState().isAuthenticated;

    // 401 при живой сессии = токен пропал, протух или невалиден (роль ни при чём
    // — отказ по роли приходит как 403). Продолжать нечем: чистим через сам
    // стор, чтобы ключи localStorage знал только он.
    if (
      error.response?.status === 401
      && !isAuthRequest
      && hadSession
      && !sessionExpiredHandled
      && window.location.pathname !== '/login'
    ) {
      sessionExpiredHandled = true;
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data: LoginRequest) => api.post<AuthResponse>('/auth/login', data),
  register: (data: RegisterRequest) => api.post<AuthResponse>('/auth/register', data),
  forgotPassword: (data: ForgotPasswordRequest) => api.post('/auth/forgot-password', data),
  resetPassword: (data: ResetPasswordRequest) => api.post('/auth/reset-password', data),
};

export const serviceApi = {
  getAll: () => api.get('/services'),
  getById: (id: number) => api.get(`/services/${id}`),
  getByMeasurementType: (type: string) => api.get(`/services/type/${type}`),
  getByLabId: (labId: number) => api.get(`/services/lab/${labId}`),
  updateTemplate: (id: number, schema: CustomFieldDef[]) =>
    api.put(`/services/${id}/template`, { customFieldsSchema: schema }),
};

export const orderApi = {
  getAll: (labId?: number) => api.get('/orders', { params: labId ? { labId } : {} }),
  getById: (id: number) => api.get(`/orders/${id}`),
  getMyOrders: (clientId: number) => api.get('/orders/my-orders', { params: { clientId } }),
  getByLabId: (labId: number) => api.get(`/orders/lab/${labId}`),
  getByStatus: (status: string) => api.get(`/orders/status/${status}`),
  create: (data: any) => api.post('/orders', data),
  saveDraft: (id: number, data: any) => api.put(`/orders/${id}/save-draft`, data),
  updateStatus: (id: number, status: string) => api.put(`/orders/${id}/status`, { status }),
  confirmPayment: (id: number, paid: boolean, comment?: string, price?: number | null) =>
    api.put(`/orders/${id}/payment`, { paid, comment, price }),
  update: (id: number, data: any) => api.put(`/orders/${id}`, data),
  returnToRevision: (id: number, comment: string) =>
    api.put(`/orders/${id}/return`, { comment }),
  resubmit: (id: number, data: any) =>
    api.put(`/orders/${id}/resubmit`, data),
  sendInvoice: (id: number) =>
    api.put(`/orders/${id}/send-invoice`),
  uploadReceipt: (id: number, fileData: string, fileName: string) =>
    api.put(`/orders/${id}/upload-receipt`, { fileData, fileName }),
  getReceipt: (id: number) =>
    api.get(`/orders/${id}/receipt`),
  assignLab: (id: number, labId: number, metrologistId: number) =>
    api.put(`/orders/${id}/assign-lab`, { labId, metrologistId }),
  notifyDirector: (id: number) =>
    api.put(`/orders/${id}/notify-director`),
  setPrice: (id: number, price: number) =>
    api.put(`/orders/${id}/set-price`, { price }),
  submitExpertise: (id: number, data: {
    testProgramDraftFile: string;
    testProgramDraftFileName: string;
    typeDescriptionDraftFile: string;
    typeDescriptionDraftFileName: string;
    expertiseConclusion: string;
  }) => api.put(`/orders/${id}/submit-expertise`, data),
};

export const pdfApi = {
  downloadCertificate: (orderId: number) =>
    api.get(`/pdf/certificate/${orderId}`, { responseType: 'blob' }),
  downloadInvoice: (orderId: number) =>
    api.get(`/pdf/invoice/${orderId}`, { responseType: 'blob' }),
};

export const contractApi = {
  getByOrderId: (orderId: number) => api.get(`/contracts/${orderId}`),
  // Договоры пачкой: один запрос на всю страницу вместо одного на заявку.
  // Ответ — словарь orderId -> договор; заявки без договора просто отсутствуют.
  getManyByOrderIds: (orderIds: number[]) =>
    api.get('/contracts', { params: { orderIds: orderIds.join(',') } }),
  uploadContract: (orderId: number, fileData: string, fileName: string) =>
    api.post(`/contracts/${orderId}`, { fileData, fileName }),
  submit: (orderId: number) => api.put(`/contracts/${orderId}/submit`),
  downloadFile: (orderId: number) =>
    api.get(`/contracts/${orderId}/file`, { responseType: 'blob' }),
  signByApprover: (orderId: number, userId: number) =>
    api.put(`/contracts/${orderId}/sign/approver`, { userId }),
  signByFinancier: (orderId: number, userId: number) =>
    api.put(`/contracts/${orderId}/sign/financier`, { userId }),
  signByDirector: (orderId: number, userId: number) =>
    api.put(`/contracts/${orderId}/sign/director`, { userId }),
  signByClient: (orderId: number, userId: number) =>
    api.put(`/contracts/${orderId}/sign/client`, { userId }),
  signByGenDirector: (orderId: number, userId: number) =>
    api.put(`/contracts/${orderId}/sign/gen_director`, { userId }),
  reject: (orderId: number, userId: number, reason: string, role: string) =>
    api.put(`/contracts/${orderId}/reject`, { userId, reason, role }),
  annul: (orderId: number, userId: number, reason: string) =>
    api.put(`/contracts/${orderId}/annul`, { userId, reason }),
  terminate: (orderId: number, userId: number, reason: string) =>
    api.put(`/contracts/${orderId}/terminate`, { userId, reason }),
  download: (orderId: number) =>
    api.get(`/contracts/${orderId}/download`, { responseType: 'blob' }),
};

export const notificationApi = {
  // userId не передаётся: бэкенд берёт пользователя из токена.
  getAll: () => api.get('/notifications'),
  getUnread: () => api.get('/notifications/unread'),
  markAsRead: (id: number) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
};

export const resultApi = {
  getByOrderId: (orderId: number) => api.get(`/results/order/${orderId}`),
  create: (data: any) => api.post('/results', data),
};

export const laboratoryApi = {
  getAll: () => api.get('/laboratories'),
};

export const userApi = {
  // userId не передаётся: бэкенд берёт профиль владельца токена.
  getProfile: () => api.get('/profile'),
  updateProfile: (data: any) => api.put('/profile', data),
  getClients: () => api.get('/users/clients'),
  getMetrologistsByLab: (labId: number) => api.get(`/users/metrologists/${labId}`),
};

export const messageApi = {
  getByOrderId: (orderId: number) => api.get(`/messages/${orderId}`),
  // senderId не передаётся: отправителя бэкенд берёт из токена.
  send: (orderId: number, text: string) =>
    api.post(`/messages/${orderId}`, { text }),
};

export default api;