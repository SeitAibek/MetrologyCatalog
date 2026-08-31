import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { AuthResponse, LoginRequest, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest } from '../types';

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
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
};

export const orderApi = {
  getAll: (labId?: number) => api.get('/orders', { params: labId ? { labId } : {} }),
  getById: (id: number) => api.get(`/orders/${id}`),
  getMyOrders: (clientId: number) => api.get('/orders/my-orders', { params: { clientId } }),
  getByLabId: (labId: number) => api.get(`/orders/lab/${labId}`),
  getByStatus: (status: string) => api.get(`/orders/status/${status}`),
  create: (data: any) => api.post('/orders', data),
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
  getAll: (userId: number) => api.get('/notifications', { params: { userId } }),
  getUnread: (userId: number) => api.get('/notifications/unread', { params: { userId } }),
  markAsRead: (id: number) => api.put(`/notifications/${id}/read`),
  markAllAsRead: (userId: number) => api.put('/notifications/read-all', null, { params: { userId } }),
};

export const resultApi = {
  getByOrderId: (orderId: number) => api.get(`/results/order/${orderId}`),
  create: (data: any) => api.post('/results', data),
};

export const laboratoryApi = {
  getAll: () => api.get('/laboratories'),
};

export const userApi = {
  getProfile: (userId: number) => api.get('/profile', { params: { userId } }),
  updateProfile: (data: any) => api.put('/profile', data),
  getClients: () => api.get('/users/clients'),
  getMetrologistsByLab: (labId: number) => api.get(`/users/metrologists/${labId}`),
};

export const messageApi = {
  getByOrderId: (orderId: number) => api.get(`/messages/${orderId}`),
  send: (orderId: number, senderId: number, text: string) =>
    api.post(`/messages/${orderId}`, { senderId, text }),
};

export default api;