import { dbQuery, dbTransaction } from '../db';
import { calculateBookingPrice } from '../pricing/calculator';
import { transitionBookingStatus } from './stateMachine';
import { VehiclePricing, BookingPriceQuote } from '../types';
import crypto from 'crypto';

export interface CreateBookingRequestInput {
  vehicleId: string;
  customerId: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  pickupLocationApprox: string;
}

export function generateBookingReference(): string {
  // Format: KVR-XXXXXX (6 alphanumeric chars, excluding ambiguous letters 0/O, 1/I)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let ref = 'KVR-';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    ref += chars[bytes[i] % chars.length];
  }
  return ref;
}

export async function createBookingRequest(input: CreateBookingRequestInput) {
  return await dbTransaction(async ({ query }) => {
    // 1. Fetch vehicle and pricing
    const vRes = await query(
      `SELECT v.*, p.daily_price, p.weekly_price, p.minimum_rental_days, p.maximum_rental_days,
              p.included_km_per_day, p.extra_km_price, p.security_deposit, p.booking_advance_pct,
              p.cleaning_fee, p.delivery_fee, p.pickup_fee, p.late_fee_per_hour, p.fuel_policy,
              p.outstation_allowed, p.interstate_allowed, p.currency
       FROM vehicles v
       JOIN vehicle_pricing p ON p.vehicle_id = v.id
       WHERE v.id = $1`,
      [input.vehicleId]
    );

    if (vRes.rows.length === 0) {
      throw new Error('Vehicle not found or pricing not configured');
    }

    const vehicle = vRes.rows[0];

    if (vehicle.listing_status !== 'LIVE' || vehicle.eligibility_status !== 'ELIGIBLE') {
      throw new Error('Vehicle is currently not available for rental booking');
    }

    // 2. Verify Customer ID Verification Status (KYC Guardrail)
    const kycRes = await query(
      `SELECT status FROM verification_records 
       WHERE user_id = $1 AND verification_type = 'IDENTITY' AND status = 'VERIFIED'`,
      [input.customerId]
    );

    if (kycRes.rows.length === 0) {
      throw new Error('Customer identity verification (KYC) must be verified before requesting a rental');
    }

    // 3. Compute immutable price quote
    const pricing: VehiclePricing = {
      vehicle_id: vehicle.id,
      daily_price: Number(vehicle.daily_price),
      weekly_price: vehicle.weekly_price ? Number(vehicle.weekly_price) : undefined,
      minimum_rental_days: vehicle.minimum_rental_days,
      maximum_rental_days: vehicle.maximum_rental_days,
      included_km_per_day: vehicle.included_km_per_day,
      extra_km_price: Number(vehicle.extra_km_price),
      security_deposit: Number(vehicle.security_deposit),
      booking_advance_pct: vehicle.booking_advance_pct,
      cleaning_fee: Number(vehicle.cleaning_fee),
      delivery_fee: Number(vehicle.delivery_fee),
      pickup_fee: Number(vehicle.pickup_fee),
      late_fee_per_hour: Number(vehicle.late_fee_per_hour),
      fuel_policy: vehicle.fuel_policy,
      outstation_allowed: vehicle.outstation_allowed,
      interstate_allowed: vehicle.interstate_allowed,
      currency: vehicle.currency,
    };

    const quote = calculateBookingPrice({
      pricing,
      startTime: input.startTime,
      endTime: input.endTime,
    });

    const bookingId = `bk_${crypto.randomUUID()}`;
    const bookingReference = generateBookingReference();

    // 4. Insert booking in REQUESTED status
    await query(
      `INSERT INTO bookings (
         id, booking_reference, vehicle_id, customer_id, owner_id,
         start_time, end_time, pickup_location_approx, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'REQUESTED')`,
      [
        bookingId,
        bookingReference,
        vehicle.id,
        input.customerId,
        vehicle.owner_id,
        new Date(input.startTime).toISOString(),
        new Date(input.endTime).toISOString(),
        input.pickupLocationApprox || vehicle.approximate_area,
      ]
    );

    // 5. Store immutable price snapshot
    await query(
      `INSERT INTO booking_price_snapshots (
         booking_id, rental_amount, duration_days, included_km_total, extra_km_rate,
         security_deposit, platform_fee, tax_amount, delivery_fee, discount_amount,
         total_payable_now, owner_net_expected, currency, policy_version
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        bookingId,
        quote.rentalAmount,
        quote.durationDays,
        quote.includedKmTotal,
        quote.extraKmRate,
        quote.securityDeposit,
        quote.platformFee,
        quote.taxAmount,
        quote.deliveryFee,
        quote.discountAmount,
        quote.totalPayableNow,
        quote.ownerNetExpected,
        quote.currency,
        quote.policyVersion,
      ]
    );

    // 6. Record status history
    await query(
      `INSERT INTO booking_status_history (id, booking_id, from_status, to_status, actor_id, actor_role, reason)
       VALUES ($1, $2, 'DRAFT', 'REQUESTED', $3, 'CUSTOMER', 'Customer requested booking')`,
      [`bsh_${crypto.randomUUID()}`, bookingId, input.customerId]
    );

    return {
      bookingId,
      bookingReference,
      status: 'REQUESTED',
      quote,
    };
  });
}

/**
 * Concurrency-Safe Owner Acceptance with Booking Hold
 * Locks the vehicle row and ensures zero double-booking overlaps.
 */
export async function acceptBookingAndCreateHold(
  bookingId: string,
  ownerId: string,
  holdDurationMinutes: number = 15
) {
  return await dbTransaction(async ({ query }) => {
    // 1. Fetch booking under update lock
    const bRes = await query(
      `SELECT b.*, v.id as v_id FROM bookings b 
       JOIN vehicles v ON v.id = b.vehicle_id
       WHERE b.id = $1 FOR UPDATE`,
      [bookingId]
    );

    if (bRes.rows.length === 0) {
      throw new Error(`Booking not found: ${bookingId}`);
    }

    const booking = bRes.rows[0];

    if (booking.owner_id !== ownerId) {
      throw new Error('Unauthorized: only the vehicle owner can accept this booking');
    }

    if (booking.status !== 'REQUESTED') {
      throw new Error(`Cannot accept booking in current status: ${booking.status}`);
    }

    const startTime = new Date(booking.start_time);
    const endTime = new Date(booking.end_time);

    // 2. CRITICAL CONCURRENCY CHECK: Lock vehicle row to serialize conflicting attempts
    await query(`SELECT id FROM vehicles WHERE id = $1 FOR UPDATE`, [booking.vehicle_id]);

    // 3. Check for conflicting active bookings (CONFIRMED, ACTIVE_RENTAL, PICKUP_PENDING)
    const conflictBookingRes = await query(
      `SELECT id, booking_reference, start_time, end_time FROM bookings
       WHERE vehicle_id = $1
         AND id != $2
         AND status IN ('CONFIRMED', 'PICKUP_PENDING', 'ACTIVE_RENTAL', 'RETURN_PENDING')
         AND (start_time < $4 AND end_time > $3)`,
      [booking.vehicle_id, bookingId, startTime.toISOString(), endTime.toISOString()]
    );

    if (conflictBookingRes.rows.length > 0) {
      throw new Error(
        `Double-booking prevented: Vehicle is already confirmed booked for reference ${conflictBookingRes.rows[0].booking_reference}`
      );
    }

    // 4. Check for active unexpired booking holds on the same vehicle
    const activeHoldRes = await query(
      `SELECT h.*, b.booking_reference FROM booking_holds h
       JOIN bookings b ON b.id = h.booking_id
       WHERE h.vehicle_id = $1
         AND h.booking_id != $2
         AND h.is_released = FALSE
         AND h.expires_at > CURRENT_TIMESTAMP
         AND (h.hold_start < $4 AND h.hold_end > $3)`,
      [booking.vehicle_id, bookingId, startTime.toISOString(), endTime.toISOString()]
    );

    if (activeHoldRes.rows.length > 0) {
      throw new Error(
        `Vehicle slot currently on payment hold for booking ${activeHoldRes.rows[0].booking_reference}. Hold expires at ${activeHoldRes.rows[0].expires_at}`
      );
    }

    // 5. Create new booking hold
    const holdId = `hld_${crypto.randomUUID()}`;
    const deadline = new Date(Date.now() + holdDurationMinutes * 60 * 1000);

    await query(
      `INSERT INTO booking_holds (id, booking_id, vehicle_id, hold_start, hold_end, expires_at, is_released)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)
       ON CONFLICT (booking_id) DO UPDATE SET
         expires_at = EXCLUDED.expires_at,
         is_released = FALSE`,
      [holdId, bookingId, booking.vehicle_id, startTime.toISOString(), endTime.toISOString(), deadline.toISOString()]
    );

    // 6. Transition to OWNER_ACCEPTED, then PAYMENT_PENDING
    await query(
      `UPDATE bookings SET 
         status = 'PAYMENT_PENDING',
         payment_deadline = $1,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [deadline.toISOString(), bookingId]
    );

    // Log history
    await query(
      `INSERT INTO booking_status_history (id, booking_id, from_status, to_status, actor_id, actor_role, reason)
       VALUES ($1, $2, 'REQUESTED', 'PAYMENT_PENDING', $3, 'OWNER', 'Owner accepted booking. Payment window opened.')`,
      [`bsh_${crypto.randomUUID()}`, bookingId, ownerId]
    );

    return {
      success: true,
      bookingId,
      status: 'PAYMENT_PENDING',
      paymentDeadline: deadline,
      holdExpiresAt: deadline,
    };
  });
}

/**
 * Idempotent background worker to expire stale payment holds
 */
export async function expireStaleHoldsWorker() {
  return await dbTransaction(async ({ query }) => {
    const expiredHolds = await query(
      `SELECT h.id as hold_id, h.booking_id, b.status 
       FROM booking_holds h
       JOIN bookings b ON b.id = h.booking_id
       WHERE h.is_released = FALSE
         AND h.expires_at < CURRENT_TIMESTAMP
         AND b.status = 'PAYMENT_PENDING'
       FOR UPDATE`,
      []
    );

    let expiredCount = 0;

    for (const row of expiredHolds.rows) {
      // Mark hold released
      await query(`UPDATE booking_holds SET is_released = TRUE WHERE id = $1`, [row.hold_id]);

      // Transition booking to EXPIRED
      await query(
        `UPDATE bookings SET status = 'EXPIRED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [row.booking_id]
      );

      // Record status transition
      await query(
        `INSERT INTO booking_status_history (id, booking_id, from_status, to_status, actor_id, actor_role, reason)
         VALUES ($1, $2, 'PAYMENT_PENDING', 'EXPIRED', NULL, 'SYSTEM', 'Payment deadline exceeded. Hold released.')`,
        [`bsh_${crypto.randomUUID()}`, row.booking_id]
      );

      expiredCount++;
    }

    return { expiredCount };
  });
}
