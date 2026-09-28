# Financial Ledger, Payments & Deposit Settlement
## Kerala Vehicle Rental & Used Marketplace (KVRM)

### 1. Legal Stance on Escrow & Money Flow
- **Non-Bank Escrow Disclaimer:** In India, true "escrow" accounts can only be maintained by RBI-authorized Escrow Agents or Scheduled Commercial Banks under RBI nodal/escrow directions.
- Unless and until an authorized nodal escrow agreement (e.g., Razorpay Route Nodal Account / ICICI Escrow) is formally executed, the platform must never claim to operate an "independent legal escrow".
- The platform uses a **Holding & Earmarked Deposit Model**, where customer rental fees and security deposits are captured via gateway nodal accounts and accounted for using an immutable **double-entry ledger**.

---

### 2. Double-Entry Accounting Architecture

Every financial event in the platform writes balanced entries into the `ledger_entries` table:

```sql
CREATE TABLE ledger_entries (
    id VARCHAR(64) PRIMARY KEY,
    booking_id VARCHAR(64) REFERENCES bookings(id),
    entry_type VARCHAR(64) NOT NULL, -- RENTAL_REVENUE, PLATFORM_COMMISSION, SECURITY_DEPOSIT_RECEIPT, DAMAGE_DEDUCTION, DEPOSIT_REFUND, HOST_PAYOUT
    direction VARCHAR(16) NOT NULL,  -- DEBIT, CREDIT
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(8) DEFAULT 'INR',
    account_reference VARCHAR(64) NOT NULL, -- OWNER, PLATFORM, DEPOSIT_ESCROW, GATEWAY
    provider_reference VARCHAR(128),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### Typical Booking Lifecycle Financial Ledger Entries:

1. **On Payment Confirmation (Total Collected: ₹9,037.20):**
   - Rental Amount (Host credit): `CREDIT ₹5,400.00` to `OWNER`
   - Platform Commission (10%): `CREDIT ₹540.00` to `PLATFORM`
   - GST on Commission (18%): `CREDIT ₹97.20` to `PLATFORM`
   - Security Deposit Held: `CREDIT ₹3,000.00` to `DEPOSIT_ESCROW`
   - Total Gateway Inflow: `DEBIT ₹9,037.20` to `GATEWAY`

2. **On Return Inspection & Deposit Settlement (e.g. ₹600 Excess Deductions):**
   - Deductions (Excess Km & Fuel): `DEBIT ₹600.00` from `DEPOSIT_ESCROW` -> `CREDIT ₹600.00` to `OWNER`
   - Refund to Renter: `DEBIT ₹2,400.00` from `DEPOSIT_ESCROW` -> Initiates Gateway Refund to Customer Card/UPI.
   - Deposit Status: Transitions to `PARTIALLY_REFUNDED`.

3. **On Clean Return (₹0 Deductions):**
   - Refund to Renter: `DEBIT ₹3,000.00` from `DEPOSIT_ESCROW` -> Initiates 100% Gateway Refund.
   - Deposit Status: Transitions to `FULLY_REFUNDED`.

---

### 3. Payment Gateway Provider Architecture

The platform abstracts payment providers through the `PaymentProvider` interface:

```typescript
export interface PaymentProvider {
  name: string;
  createOrder(params: CreateOrderParams): Promise<PaymentOrderResult>;
  verifyPaymentSignature(params: VerifySignatureParams): boolean;
  parseAndVerifyWebhook(rawBody: string, headers: Record<string, string>): Promise<PaymentWebhookPayload>;
  createRefund(paymentId: string, amount: number, reason: string): Promise<{ refundId: string; status: string }>;
  createPayout(ownerId: string, amount: number, accountDetails: any): Promise<{ payoutId: string; status: string }>;
}
```

Two concrete implementations are provided:
1. **`RazorpayProvider`:**
   - Production-ready adapter calling official Razorpay REST APIs (`/v1/orders`, `/v1/payments/{id}/refund`, etc.).
   - Cryptographic HMAC-SHA256 signature verification for checkout callbacks and webhooks.
2. **`MockPaymentProvider`:**
   - High-speed local and staging testing adapter allowing full end-to-end integration runs without contacting external banking networks.

---

### 4. Webhook Idempotency & Replay Attack Defense

The webhook endpoint (`/api/payments/webhook`) prevents duplicate credits or replay attacks:
1. **Signature Verification:** Validates `X-Razorpay-Signature` against `RAZORPAY_WEBHOOK_SECRET` before parsing body.
2. **Event Deduplication:** Checks `payment_webhook_events` table for `event_id`:
   ```sql
   INSERT INTO payment_webhook_events (id, event_id, event_type, payload, status)
   VALUES ($1, $2, $3, $4, 'PROCESSED')
   ON CONFLICT (event_id) DO NOTHING;
   ```
3. **Atomic Execution:** Payment confirmation, hold release, booking status update to `CONFIRMED`, and ledger writes occur within a single database transaction.

---

### 5. Deposit Settlement & Dispute Lockout

- While a booking is in `DISPUTED` status, **no host can settle or withdraw the security deposit**.
- Deposit settlement requires:
  - Return inspection completed (`RETURNED` / `DEPOSIT_PENDING`).
  - Total deductions strictly `<= amount_held`.
  - Disputed deposits can only be settled by an authorized Administrator or Dispute Arbitrator (`src/app/api/disputes/[id]/resolve`).
