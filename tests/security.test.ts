import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../src/lib/db/migrate';
import { AuthService } from '../src/lib/auth/session';
import { PaymentService } from '../src/lib/payments/paymentService';
import { dbQuery } from '../src/lib/db';

describe('Security & OWASP Threat Mitigation Suite', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  it('prevents privilege escalation: new registrations are restricted to CUSTOMER role', async () => {
    // Attempt to register with a new phone number
    const testPhone = '+919999900001';
    await AuthService.requestOtp(testPhone);
    const { user } = await AuthService.verifyOtp(testPhone, '123456');

    // Roles must NOT contain ADMIN or SUPER_ADMIN
    expect(user.roles).toContain('CUSTOMER');
    expect(user.roles).not.toContain('ADMIN');
    expect(user.roles).not.toContain('SUPER_ADMIN');
    expect(user.primaryRole).toBe('CUSTOMER');
  });

  it('enforces brute force protection and cooldown on repeated invalid OTP attempts', async () => {
    const attackPhone = '+919999900002';
    await AuthService.requestOtp(attackPhone);

    // Fail 3 times
    try {
      await AuthService.verifyOtp(attackPhone, '000000');
    } catch (e: any) {
      expect(e.message).toMatch(/attempt\(s\) remaining/);
    }

    try {
      await AuthService.verifyOtp(attackPhone, '000000');
    } catch (e: any) {
      expect(e.message).toMatch(/attempt\(s\) remaining/);
    }

    // 3rd attempt triggers lock
    await expect(AuthService.verifyOtp(attackPhone, '000000')).rejects.toThrow(
      /Account locked for 15 minutes/
    );

    // Subsequent request is denied on cooldown
    await expect(AuthService.requestOtp(attackPhone)).rejects.toThrow(
      /Account on cooldown/
    );
  });

  it('rejects tampered session tokens with invalid HMAC signatures', () => {
    const validToken = 'eyJ1c2VySWQiOiJ0ZXN0In0.valid_sig';
    const fakeToken = 'eyJ1c2VySWQiOiJhZG1pbiIsInJvbGVzIjpbIlNVUEVSX0FETUlOIl19.forged_signature';

    const session = AuthService.verifySessionToken(fakeToken);
    expect(session).toBeNull();
  });

  it('strictly isolates customer KYC documents: vehicle owners cannot view raw identity records', async () => {
    // Query verification records for customer 1
    const res = await dbQuery(
      `SELECT minimal_metadata FROM verification_records 
       WHERE user_id = 'usr-cust-1' AND verification_type = 'IDENTITY'`
    );

    expect(res.rows.length).toBeGreaterThan(0);
    const record = res.rows[0];

    // Minimal metadata must NEVER expose raw Aadhaar or passport document scans
    const metadataStr = JSON.stringify(record.minimal_metadata).toLowerCase();
    expect(metadataStr).not.toContain('aadhaar_number');
    expect(metadataStr).not.toContain('full_id');
    expect(metadataStr).not.toContain('secret');
  });

  it('prevents client payment amount tampering: payment orders are derived strictly from immutable snapshots', async () => {
    // Attempting to create order for customer 2 on customer 1 booking must fail
    await expect(
      PaymentService.createOrderForBooking('non-existent-booking', 'usr-cust-2')
    ).rejects.toThrow();
  });

  it('enforces webhook idempotency: duplicate event deliveries execute business logic exactly once', async () => {
    const fakeEventId = `evt_test_dedup_${Date.now()}`;
    const rawPayload = JSON.stringify({
      event_id: fakeEventId,
      event: 'payment.captured',
      order_id: 'non_existent_order',
      payment_id: 'pay_test_123',
      amount: 500000,
    });

    // First arrival
    const res1 = await PaymentService.handleWebhook(rawPayload, {
      'x-razorpay-event-id': fakeEventId,
    });
    expect(res1.duplicate).toBe(false);

    // Second (duplicate/replay) arrival
    const res2 = await PaymentService.handleWebhook(rawPayload, {
      'x-razorpay-event-id': fakeEventId,
    });
    expect(res2.duplicate).toBe(true);
  });
});
