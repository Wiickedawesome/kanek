/** E-Kyash API request/response types — mirrors the Bank API spec */

// === Authorization ===

export interface EkyashAuthRequest {
  sid: string;
  pinHash: string;
  pushkey: string;
}

export interface EkyashAuthResponse {
  session: string;
  firstName: string | null;
  lastName: string | null;
  mobile: string | null;
  settings: Record<string, unknown> | null;
}

// === Create New Invoice ===

export interface EkyashCreateInvoiceRequest {
  session: string;
  orderId: string;
  amount: number; // cents (1000 = $10 BZD)
  currency: string; // 'BZD'
  description: string;
  payer: string | null; // phone number or null
  longTerm: boolean;
  receipt: string | null;
  dateLife: string | null;
  fieldsOther: Record<string, unknown> | null;
  fieldsApp: Record<string, unknown> | null;
}

export interface EkyashCreateInvoiceResponse {
  invoiceId: string;
  qrUrl: string;
  qrData: string;
  receiptUrl: string | null;
  paymentLink: string | null;
}

// === Callback (webhook) ===

export interface EkyashCallbackPayload {
  orderId: string;
  invoiceId: string;
  transactionId: string;
  statusPay: 0 | 2 | 3; // 0=new, 2=declined, 3=approved
  hash: string;
}

// === Cancel Invoice ===

export interface EkyashCancelInvoiceRequest {
  session: string;
  invoiceId: string;
}

export interface EkyashCancelInvoiceResponse {
  success: boolean;
}

// === Refund Transaction ===

export interface EkyashRefundRequest {
  session: string;
  transactionId: string;
  amount: number;
  pinHash: string;
  refundReason?: string;
}

export interface EkyashRefundResponse {
  success: boolean;
}

// === Get Invoice Info ===

export interface EkyashInvoiceInfoRequest {
  session: string;
  orderId: string | null;
  invoiceId: string | null;
}

export interface EkyashInvoiceTransaction {
  createdAt: string;
  datePay: string | null;
  transactionId: string;
  transactionType: string;
  amount: number;
  statusPay: number;
  statusPayName: string;
  payerMobile: string | null;
  payerFirstName: string | null;
  payerLastName: string | null;
}

export interface EkyashInvoiceInfo {
  createdAt: string;
  invoiceId: string;
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  statusPay: number;
  statusPayName: string;
  transactions: EkyashInvoiceTransaction[];
}

export interface EkyashInvoiceInfoResponse {
  list: EkyashInvoiceInfo[];
  page: number;
  rows: number;
  count: number;
}

// === Edge Function responses (our wrappers) ===

export interface CreatePaymentResponse {
  orderId: string;
  invoiceId: string;
  qrUrl: string;
  paymentLink: string | null;
  amountCents: number;
  platformFeeCents: number;
  donationCents: number;
}

export interface PaymentStatusResponse {
  status: 'pending' | 'approved' | 'cancelled' | 'refunded';
  transactionId: string | null;
}
