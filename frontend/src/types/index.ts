export interface User {
  id: number;
  idNumber: string;
  email?: string;
  role: 'client' | 'metrolog' | 'manager' | 'director' | 'gen_director' | 'financier' | 'approver' | 'admin';
  fullName: string;
  phone?: string;
  companyId?: number;
  labId?: number;
  isActive: boolean;
}

export interface Company {
  id: number;
  bin: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface Laboratory {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  city?: string;
  email?: string;
}

export type CustomFieldType = 'text' | 'textarea' | 'number' | 'date' | 'select';
export type CustomFieldScope = 'item' | 'order';

export interface CustomFieldDef {
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  scope: CustomFieldScope;
  options?: string[];
}

export type CustomFieldValues = Record<string, string | number>;

export interface Service {
  id: number;
  name: string;
  description?: string;
  measurementType: string;
  price?: number | null;
  durationDays: number;
  labId: number;
  isActive: boolean;
  standard?: string;
  labName?: string;
  customFieldsSchema?: CustomFieldDef[];
}

export type OrderStatus =
  | 'draft'
  | 'pending_contract'
  | 'revision'
  | 'awaiting_approval'
  | 'awaiting_payment'
  | 'pending_delivery'
  | 'awaiting_delivery'
  | 'received_in_lab'
  | 'expertise'
  | 'in_work'
  | 'under_review'
  | 'completed'
  | 'cancelled'
  | 'annulled'
  | 'terminated';

export interface Order {
  id: number;
  orderNumber: string;
  clientId: number;
  serviceId: number;
  labId: number;
  assignedLabId?: number;
  // Имена связанных сущностей — списки показывают их вместо id.
  serviceName?: string;
  labName?: string;
  clientName?: string;
  assignedAt?: string;
  status: OrderStatus;
  // null = финансист ещё не объявил цену
  price?: number | null;
  dueDate?: string;
  metrologistId?: number;
  clientComment?: string;
  managerComment?: string;
  invoiceSent?: boolean;
  paymentReceiptName?: string;
  receiptUploadedAt?: string;
  powerOfAttorneyFileName?: string;
  techDocumentationFileName?: string;
  testProgramDraftFileName?: string;
  typeDescriptionDraftFileName?: string;
  expertiseConclusion?: string;
  customFieldsSchema?: CustomFieldDef[];
  customFieldsValues?: CustomFieldValues;
}

export interface OrderItem {
  id: number;
  orderId: number;
  deviceType: string;
  model: string;
  serialNumber: string;
  quantity: number;
  customFieldsSchema?: CustomFieldDef[];
  customFieldsValues?: CustomFieldValues;
}

export type ContractStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'signed'
  | 'rejected'
  | 'annulled'
  | 'terminated';

export interface Contract {
  id: number;
  orderId: number;
  contractNumber: string;
  registrationNumber?: string;
  contractFileName?: string;
  filePath?: string;
  status: ContractStatus;
  directorSigned: boolean;
  directorSignedAt?: string;
  approverSigned: boolean;
  approverSignedAt?: string;
  financierSigned: boolean;
  financierSignedAt?: string;
  clientSigned: boolean;
  clientSignedAt?: string;
  genDirectorSigned: boolean;
  genDirectorSignedAt?: string;
  rejectedByRole?: string;
  rejectedReason?: string;
  annulledAt?: string;
  annulledReason?: string;
  terminatedAt?: string;
  terminatedReason?: string;
}

export interface Result {
  id: number;
  orderId: number;
  resultType: 'certificate' | 'protocol' | 'report';
  issuedAt?: string;
  filePath?: string;
  metrologistId: number;
  isSigned: boolean;
  signedAt?: string;
}

export interface Device {
  id: number;
  companyId: number;
  type: string;
  model?: string;
  serialNumber: string;
  lastVerifiedAt?: string;
  nextVerificationDate?: string;
}

export type NotificationType =
  | 'order_status'
  | 'document_ready'
  | 'reminder'
  | 'approval_required'
  | 'payment_received'
  | 'assigned_to_lab'
  | 'receipt_uploaded';

export interface Notification {
  id: number;
  userId: number;
  orderId?: number;
  message: string;
  notificationType: NotificationType;
  isRead: boolean;
  readAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  idNumber: string;
  password: string;
}

export interface RegisterRequest {
  idNumber: string;
  email?: string;
  password: string;
  fullName: string;
  phone: string;
  bin: string;
  companyName: string;
  companyAddress: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface Message {
  id: number;
  orderId: number;
  senderId: number;
  senderRole: string;
  text: string;
  createdAt: string;
}