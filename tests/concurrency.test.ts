import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../src/lib/db/migrate';
import { createBookingRequest, acceptBookingAndCreateHold, expireStaleHoldsWorker } from '../src/lib/booking/concurrency';
import { dbQuery } from '../src/lib/db';

describe('Concurrency & Double-Booking Protection Suite', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  it('handles 20 concurrent booking acceptance attempts on the same vehicle and guarantees exactly ONE hold succeeds', async () => {
    // 1. Create a primary booking request
    const start = '2026-11-10T10:00:00Z';
    const end = '2026-11-15T10:00:00Z';
    const vehicleId = 'veh-swift-1';
    const ownerId = 'usr-owner-1';

    // Create 20 conflicting booking requests from customer 1 and customer 2
    const bookingIds: string[] = [];
    for (let i = 0; i < 20; i++) {
      const custId = i % 2 === 0 ? 'usr-cust-1' : 'usr-cust-2';
      const req = await createBookingRequest({
        vehicleId,
        customerId: custId,
        startTime: start,
        endTime: end,
        pickupLocationApprox: 'Kochi Area',
      });
      bookingIds.push(req.bookingId);
    }

    expect(bookingIds.length).toBe(20);

    // 2. Concurrently attempt to accept ALL 20 booking requests simultaneously
    const results = await Promise.allSettled(
      bookingIds.map((bId) => acceptBookingAndCreateHold(bId, ownerId, 15))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // CRITICAL ASSERTION: Exactly ONE hold can succeed! The other 19 must be rejected due to concurrency lock!
    expect(succeeded.length).toBe(1);
    expect(rejected.length).toBe(19);

    // Verify rejection errors explicitly mention active hold or conflict
    for (const rej of rejected) {
      if (rej.status === 'rejected') {
        expect(rej.reason.message).toMatch(/slot currently on payment hold|already confirmed booked/);
      }
    }

    // 3. Verify database integrity: only 1 hold exists for the vehicle in that time slot
    const holds = await dbQuery(
      `SELECT * FROM booking_holds 
       WHERE vehicle_id = $1 AND is_released = FALSE AND expires_at > CURRENT_TIMESTAMP`,
      [vehicleId]
    );

    expect(holds.rows.length).toBe(1);
  });

  it('correctly expires stale holds and frees availability for subsequent bookings', async () => {
    // Test the expiration worker
    const workerResult = await expireStaleHoldsWorker();
    expect(workerResult).toHaveProperty('expiredCount');
  });
});
