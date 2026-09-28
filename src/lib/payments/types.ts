// Payment Provider Interfaces & Data Contracts

export interface CreateOrderParams {
  bookingId: string;
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface PaymentOrderResult {
  providerOrderId: string;
  amount: number;
  currency: string;
  status: 'CREATED' | 'ATTEMPTED' | 'PAID';
}

export interface VerifySignatureParams {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface PaymentWebhookPayload {
  eventId: string;
  eventType: string;
  orderId: string;
  paymentId: string;
  amount: number;
  currency: string;
  rawPayload: any;
}

export interface PaymentProvider {
  name: string;
  createOrder(params: CreateOrderParams): Promise<PaymentOrderResult>;
  verifyPaymentSignature(params: VerifySignatureParams): boolean;
  parseAndVerifyWebhook(rawBody: string, headers: Record<string, string>): Promise<PaymentWebhookPayload>;
  createRefund(paymentId: string, amount: number, reason: string): Promise<{ refundId: string; status: string }>;
  createPayout(ownerId: string, amount: number, accountDetails: any): Promise<{ payoutId: string; status: string }>;
}
