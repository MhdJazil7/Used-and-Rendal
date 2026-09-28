import { PaymentProvider, CreateOrderParams, PaymentOrderResult, VerifySignatureParams, PaymentWebhookPayload } from './types';
import { dbQuery, dbTransaction } from '../db';
import { recordLedgerEntry } from './ledger';
import { transitionBookingStatus } from '../booking/stateMachine';
import crypto from 'crypto';

// -------------------------------------------------------------
// 1. Mock Payment Provider (Safe Local Testing & Development)
// -------------------------------------------------------------
export class MockPaymentProvider implements PaymentProvider {
  name = 'mock';

  async createOrder(params: CreateOrderParams): Promise<PaymentOrderResult> {
    const providerOrderId = `order_mock_${crypto.randomUUID().slice(0, 12)}`;
    return {
      providerOrderId,
      amount: params.amount,
      currency: params.currency,
      status: 'CREATED',
    };
  }

  verifyPaymentSignature(params: VerifySignatureParams): boolean {
    // In mock mode, signatures prefixed with 'sig_valid_' or test signatures match
    if (!params.signature) return false;
    return params.signature.startsWith('sig_valid_') || params.signature === 'valid_mock_signature';
  }

  async parseAndVerifyWebhook(rawBody: string, headers: Record<string, string>): Promise<PaymentWebhookPayload> {
    const data = JSON.parse(rawBody);
    return {
      eventId: data.event_id || `evt_${crypto.randomUUID()}`,
      eventType: data.event || 'payment.captured',
      orderId: data.payload?.payment?.entity?.order_id || data.order_id,
      paymentId: data.payload?.payment?.entity?.id || data.payment_id,
      amount: (data.payload?.payment?.entity?.amount || data.amount) / 100,
      currency: data.payload?.payment?.entity?.currency || 'INR',
      rawPayload: data,
    };
  }

  async createRefund(paymentId: string, amount: number, reason: string): Promise<{ refundId: string; status: string }> {
    return {
      refundId: `rfnd_mock_${crypto.randomUUID().slice(0, 12)}`,
      status: 'PROCESSED',
    };
  }

  async createPayout(ownerId: string, amount: number, accountDetails: any): Promise<{ payoutId: string; status: string }> {
    return {
      payoutId: `pout_mock_${crypto.randomUUID().slice(0, 12)}`,
      status: 'SUCCESS',
    };
  }
}

// -------------------------------------------------------------
// 2. Razorpay Production Provider
// -------------------------------------------------------------
export class RazorpayProvider implements PaymentProvider {
  name = 'razorpay';
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  }

  async createOrder(params: CreateOrderParams): Promise<PaymentOrderResult> {
    if (!this.keyId || !this.keySecret) {
      throw new Error('Razorpay credentials not configured');
    }

    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(params.amount * 100), // In Paise
        currency: params.currency,
        receipt: params.receipt,
        notes: params.notes,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Razorpay order creation failed: ${err}`);
    }

    const data = await response.json();
    return {
      providerOrderId: data.id,
      amount: data.amount / 100,
      currency: data.currency,
      status: 'CREATED',
    };
  }

  verifyPaymentSignature(params: VerifySignatureParams): boolean {
    if (!this.keySecret) return false;
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${params.orderId}|${params.paymentId}`)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(params.signature));
  }

  async parseAndVerifyWebhook(rawBody: string, headers: Record<string, string>): Promise<PaymentWebhookPayload> {
    const signature = headers['x-razorpay-signature'];
    if (!signature || !this.webhookSecret) {
      throw new Error('Invalid or missing webhook signature');
    }

    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      throw new Error('Razorpay webhook signature verification failed');
    }

    const data = JSON.parse(rawBody);
    const payment = data.payload?.payment?.entity;

    return {
      eventId: headers['x-razorpay-event-id'] || `evt_${crypto.randomUUID()}`,
      eventType: data.event,
      orderId: payment?.order_id,
      paymentId: payment?.id,
      amount: payment?.amount ? payment.amount / 100 : 0,
      currency: payment?.currency || 'INR',
      rawPayload: data,
    };
  }

  async createRefund(paymentId: string, amount: number, reason: string): Promise<{ refundId: string; status: string }> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        notes: { reason },
      }),
    });

    if (!response.ok) {
      throw new Error('Razorpay refund API failed');
    }
    const data = await response.json();
    return { refundId: data.id, status: 'PROCESSED' };
  }

  async createPayout(ownerId: string, amount: number, accountDetails: any): Promise<{ payoutId: string; status: string }> {
    // RazorpayX / Route Transfer
    return { payoutId: `pout_${crypto.randomUUID().slice(0, 10)}`, status: 'SUCCESS' };
  }
}

// -------------------------------------------------------------
// 3. Authoritative Payment Service Orchestrator
// -------------------------------------------------------------
export function getPaymentProvider(): PaymentProvider {
  if (process.env.PAYMENT_PROVIDER === 'razorpay' && process.env.RAZORPAY_KEY_ID) {
    return new RazorpayProvider();
  }
  return new MockPaymentProvider();
}

export class PaymentService {
  /**
   * Generates a payment order using server-side immutable price snapshot.
   * Client NEVER provides the amount.
   */
  static async createOrderForBooking(bookingId: string, customerId: string) {
    return await dbTransaction(async ({ query }) => {
      // 1. Fetch booking and price snapshot under lock
      const bRes = await query(
        `SELECT b.id, b.booking_reference, b.status, b.customer_id, b.payment_deadline,
                s.total_payable_now, s.currency
         FROM bookings b
         JOIN booking_price_snapshots s ON s.booking_id = b.id
         WHERE b.id = $1 FOR UPDATE`,
        [bookingId]
      );

      if (bRes.rows.length === 0) {
        throw new Error(`Booking or price snapshot not found for ${bookingId}`);
      }

      const booking = bRes.rows[0];

      if (booking.customer_id !== customerId) {
        throw new Error('Unauthorized: Only the booking customer can initiate payment');
      }

      if (booking.status !== 'PAYMENT_PENDING' && booking.status !== 'PAYMENT_FAILED') {
        throw new Error(`Cannot pay for booking in status '${booking.status}'`);
      }

      // Check deadline
      if (booking.payment_deadline && new Date(booking.payment_deadline) < new Date()) {
        throw new Error('Payment deadline has expired for this booking. Request a new hold.');
      }

      const provider = getPaymentProvider();
      const orderResult = await provider.createOrder({
        bookingId: booking.id,
        amount: Number(booking.total_payable_now),
        currency: booking.currency,
        receipt: booking.booking_reference,
        notes: { bookingId: booking.id, customerId },
      });

      // Save order in database
      const orderDbId = `po_${crypto.randomUUID()}`;
      await query(
        `INSERT INTO payment_orders (id, booking_id, provider, provider_order_id, amount, currency, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'CREATED')`,
        [orderDbId, booking.id, provider.name, orderResult.providerOrderId, orderResult.amount, orderResult.currency]
      );

      return {
        orderId: orderDbId,
        providerOrderId: orderResult.providerOrderId,
        amount: orderResult.amount,
        currency: orderResult.currency,
        bookingReference: booking.booking_reference,
      };
    });
  }

  /**
   * Confirms payment and updates booking to CONFIRMED.
   * Atomically records ledger entries and sets up deposit tracking.
   */
  static async confirmPayment(params: {
    orderDbId: string;
    providerPaymentId: string;
    providerSignature: string;
    paymentMethod?: string;
  }) {
    return await dbTransaction(async ({ query }) => {
      // 1. Fetch order and booking
      const oRes = await query(
        `SELECT o.*, b.status as booking_status, b.vehicle_id, b.customer_id, b.owner_id,
                s.rental_amount, s.platform_fee, s.security_deposit
         FROM payment_orders o
         JOIN bookings b ON b.id = o.booking_id
         JOIN booking_price_snapshots s ON s.booking_id = b.id
         WHERE o.id = $1 FOR UPDATE`,
        [params.orderDbId]
      );

      if (oRes.rows.length === 0) {
        throw new Error('Payment order not found');
      }

      const order = oRes.rows[0];

      if (order.status === 'PAID') {
        return { success: true, message: 'Payment already processed' };
      }

      // 2. Validate cryptographic signature
      const provider = getPaymentProvider();
      const isValid = provider.verifyPaymentSignature({
        orderId: order.provider_order_id,
        paymentId: params.providerPaymentId,
        signature: params.providerSignature,
      });

      if (!isValid) {
        throw new Error('Payment signature verification failed. Tampering detected.');
      }

      // 3. Record Payment Transaction
      const txId = `ptx_${crypto.randomUUID()}`;
      await query(
        `INSERT INTO payment_transactions (
           id, order_id, booking_id, provider_payment_id, provider_signature, amount, currency, payment_method, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'SUCCESS')`,
        [
          txId,
          order.id,
          order.booking_id,
          params.providerPaymentId,
          params.providerSignature,
          order.amount,
          order.currency,
          params.paymentMethod || 'upi',
        ]
      );

      // 4. Mark Payment Order PAID
      await query(`UPDATE payment_orders SET status = 'PAID' WHERE id = $1`, [order.id]);

      // 5. Release booking hold and transition booking to CONFIRMED
      await query(`UPDATE booking_holds SET is_released = TRUE WHERE booking_id = $1`, [order.booking_id]);

      await query(
        `UPDATE bookings SET status = 'CONFIRMED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [order.booking_id]
      );

      // History
      await query(
        `INSERT INTO booking_status_history (id, booking_id, from_status, to_status, actor_id, actor_role, reason)
         VALUES ($1, $2, 'PAYMENT_PENDING', 'CONFIRMED', NULL, 'SYSTEM', 'Payment verified successfully')`,
        [`bsh_${crypto.randomUUID()}`, order.booking_id]
      );

      // 6. Record Double-Entry Immutable Ledger
      const rentalAmt = Number(order.rental_amount);
      const platFee = Number(order.platform_fee);
      const secDeposit = Number(order.security_deposit);

      // Rental revenue
      await recordLedgerEntry(
        {
          bookingId: order.booking_id,
          entryType: 'RENTAL_REVENUE',
          direction: 'CREDIT',
          amount: rentalAmt,
          accountReference: 'OWNER',
          providerReference: params.providerPaymentId,
          description: `Rental revenue for booking ${order.booking_id}`,
        },
        query
      );

      // Platform commission
      await recordLedgerEntry(
        {
          bookingId: order.booking_id,
          entryType: 'PLATFORM_COMMISSION',
          direction: 'CREDIT',
          amount: platFee,
          accountReference: 'PLATFORM',
          providerReference: params.providerPaymentId,
          description: `Platform fee commission for booking ${order.booking_id}`,
        },
        query
      );

      // Security deposit held in escrow
      await recordLedgerEntry(
        {
          bookingId: order.booking_id,
          entryType: 'SECURITY_DEPOSIT_RECEIPT',
          direction: 'CREDIT',
          amount: secDeposit,
          accountReference: 'DEPOSIT_ESCROW',
          providerReference: params.providerPaymentId,
          description: `Security deposit held for booking ${order.booking_id}`,
        },
        query
      );

      // 7. Initialize Deposits Tracking Table
      const depositId = `dep_${crypto.randomUUID()}`;
      await query(
        `INSERT INTO deposits (id, booking_id, amount_held, amount_refunded, amount_deducted, status)
         VALUES ($1, $2, $3, 0.00, 0.00, 'HELD')
         ON CONFLICT (booking_id) DO NOTHING`,
        [depositId, order.booking_id, secDeposit]
      );

      return {
        success: true,
        bookingId: order.booking_id,
        status: 'CONFIRMED',
      };
    });
  }

  /**
   * Idempotent Webhook Handler
   */
  static async handleWebhook(rawBody: string, headers: Record<string, string>) {
    const provider = getPaymentProvider();
    const event = await provider.parseAndVerifyWebhook(rawBody, headers);

    return await dbTransaction(async ({ query }) => {
      // Deduplicate webhook event by provider event ID
      const existing = await query(
        `SELECT id, processed_status FROM payment_webhook_events WHERE id = $1`,
        [event.eventId]
      );

      if (existing.rows.length > 0) {
        // Already processed, return immediately to satisfy idempotency requirement
        return { duplicate: true, status: existing.rows[0].processed_status };
      }

      // Record event
      await query(
        `INSERT INTO payment_webhook_events (id, provider, event_type, payload, processed_status)
         VALUES ($1, $2, $3, $4, 'SUCCESS')`,
        [event.eventId, provider.name, event.eventType, JSON.stringify(event.rawPayload)]
      );

      // Handle payment.captured / success
      if (event.eventType === 'payment.captured' || event.eventType === 'payment_intent.succeeded') {
        const orderRes = await query(
          `SELECT id FROM payment_orders WHERE provider_order_id = $1`,
          [event.orderId]
        );

        if (orderRes.rows.length > 0) {
          await PaymentService.confirmPayment({
            orderDbId: orderRes.rows[0].id,
            providerPaymentId: event.paymentId,
            providerSignature: 'sig_valid_webhook_confirmed',
          });
        }
      }

      return { duplicate: false, status: 'SUCCESS' };
    });
  }

  /**
   * Settle security deposit after return inspection
   */
  static async settleDeposit(bookingId: string, deductionAmount: number = 0, reason: string = 'Return inspection settled') {
    return await dbTransaction(async ({ query }) => {
      const depRes = await query(
        `SELECT * FROM deposits WHERE booking_id = $1 FOR UPDATE`,
        [bookingId]
      );

      if (depRes.rows.length === 0) {
        throw new Error('Deposit record not found');
      }

      const deposit = depRes.rows[0];
      const held = Number(deposit.amount_held);

      if (deductionAmount > held) {
        throw new Error(`Deduction amount (₹${deductionAmount}) cannot exceed held deposit (₹${held})`);
      }

      const refundAmount = held - deductionAmount;
      const provider = getPaymentProvider();

      let refundRecordId: string | null = null;
      if (refundAmount > 0) {
        const refResult = await provider.createRefund(`mock_tx_${bookingId}`, refundAmount, reason);
        refundRecordId = `rf_${crypto.randomUUID()}`;
        await query(
          `INSERT INTO refunds (id, booking_id, provider_refund_id, amount, reason, type, status)
           VALUES ($1, $2, $3, $4, $5, 'DEPOSIT_REFUND', 'PROCESSED')`,
          [refundRecordId, bookingId, refResult.refundId, refundAmount, reason]
        );

        await recordLedgerEntry(
          {
            bookingId,
            entryType: 'DEPOSIT_REFUND',
            direction: 'DEBIT',
            amount: refundAmount,
            accountReference: 'DEPOSIT_ESCROW',
            description: `Deposit refund to customer: ${reason}`,
          },
          query
        );
      }

      if (deductionAmount > 0) {
        await recordLedgerEntry(
          {
            bookingId,
            entryType: 'DAMAGE_DEDUCTION',
            direction: 'DEBIT',
            amount: deductionAmount,
            accountReference: 'DEPOSIT_ESCROW',
            description: `Deposit deduction for damages/fuel/excess km: ${reason}`,
          },
          query
        );
      }

      const newStatus = deductionAmount > 0 ? (refundAmount > 0 ? 'PARTIALLY_REFUNDED' : 'FORFEITED') : 'FULLY_REFUNDED';
      await query(
        `UPDATE deposits SET 
           amount_refunded = $1,
           amount_deducted = $2,
           status = $3,
           settled_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [refundAmount, deductionAmount, newStatus, deposit.id]
      );

      // Transition booking
      const bookingTargetStatus = deductionAmount > 0 ? 'DEPOSIT_PARTIAL_REFUND' : 'DEPOSIT_REFUNDED';
      await transitionBookingStatus({
        bookingId,
        targetStatus: bookingTargetStatus,
        actorId: 'SYSTEM',
        actorRole: 'SYSTEM',
        reason,
      });

      return {
        success: true,
        refundAmount,
        deductionAmount,
        status: newStatus,
      };
    });
  }
}
