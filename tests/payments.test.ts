import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../src/lib/db/migrate';
import { PaymentService } from '../src/lib/payments/paymentService';
import { recordLedgerEntry } from '../src/lib/payments/ledger';
import { dbQuery } from '../src/lib/db';
import crypto from 'crypto';

describe('Payment, Ledger & Deposit Settlement Suite', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  it('records immutable ledger entries and rejects non-positive amounts', async () => {
    const entry = await recordLedgerEntry({
      entryType: 'RENTAL_REVENUE',
      direction: 'CREDIT',
      amount: 1800.0,
      accountReference: 'OWNER',
      description: 'Platform rental revenue entry',
    });

    expect(entry.id).toBeDefined();
    expect(entry.amount).toBe(1800.0);

    // Reject <= 0 amount
    await expect(
      recordLedgerEntry({
        entryType: 'RENTAL_REVENUE',
        direction: 'CREDIT',
        amount: 0,
        accountReference: 'OWNER',
        description: 'Zero amount entry',
      })
    ).rejects.toThrow(/greater than 0/);
  });

  it('handles 10 duplicate webhook calls idempotently without duplicate business side effects', async () => {
    const eventId = `evt_repeat_10x_${Date.now()}`;
    const rawPayload = JSON.stringify({
      event_id: eventId,
      event: 'payment.captured',
      order_id: 'order_test_10x',
      payment_id: 'pay_test_10x',
      amount: 450000,
    });

    // Send the exact same webhook 10 times concurrently
    const results = await Promise.all(
      Array.from({ length: 10 }).map(() =>
        PaymentService.handleWebhook(rawPayload, { 'x-razorpay-event-id': eventId })
      )
    );

    const nonDuplicates = results.filter((r) => r.duplicate === false);
    const duplicates = results.filter((r) => r.duplicate === true);

    expect(nonDuplicates.length).toBe(1); // Processed once
    expect(duplicates.length).toBe(9);    // 9 identified as duplicates and ignored
  });

  it('correctly calculates deposit settlement with damage deduction', async () => {
    const bookingId = `bk_dep_test_${Date.now()}`;
    const depositId = `dep_test_${Date.now()}`;

    // Seed dummy booking and deposit
    await dbQuery(
      `INSERT INTO bookings (id, booking_reference, vehicle_id, customer_id, owner_id, start_time, end_time, pickup_location_approx, status)
       VALUES ($1, $2, 'veh-swift-1', 'usr-cust-1', 'usr-owner-1', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + interval '1 day', 'Kochi', 'DEPOSIT_PENDING')`,
      [bookingId, `KVR-DEP${Date.now().toString().slice(-4)}`]
    );

    await dbQuery(
      `INSERT INTO deposits (id, booking_id, amount_held, amount_refunded, amount_deducted, status)
       VALUES ($1, $2, 5000.00, 0.00, 0.00, 'HELD')`,
      [depositId, bookingId]
    );

    // Settle with ₹1,200 deduction for excess km / scratch
    const res = await PaymentService.settleDeposit(bookingId, 1200, 'Scratches and 20 km excess');

    expect(res.success).toBe(true);
    expect(res.deductionAmount).toBe(1200);
    expect(res.refundAmount).toBe(3800); // 5000 - 1200
    expect(res.status).toBe('PARTIALLY_REFUNDED');

    // Verify deposit record in DB
    const depDb = await dbQuery(`SELECT * FROM deposits WHERE id = $1`, [depositId]);
    expect(Number(depDb.rows[0].amount_deducted)).toBe(1200.0);
    expect(Number(depDb.rows[0].amount_refunded)).toBe(3800.0);
  });
});
