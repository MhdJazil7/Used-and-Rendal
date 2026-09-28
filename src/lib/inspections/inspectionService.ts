import { dbQuery, dbTransaction } from '../db';
import { transitionBookingStatus } from '../booking/stateMachine';
import crypto from 'crypto';

export interface PickupInspectionInput {
  bookingId: string;
  inspectorId: string;
  odometerReading: number;
  fuelPercentage: number;
  evChargePercentage?: number;
  cleanlinessRating: number;
  existingScratchesNotes?: string;
  accessoriesVerified: string[];
  photos: string[];
}

export interface ReturnInspectionInput {
  bookingId: string;
  inspectorId: string;
  odometerReading: number;
  fuelPercentage: number;
  evChargePercentage?: number;
  newDamagesFound: boolean;
  damageNotes?: string;
  damageClaimAmount?: number;
  damageCategory?: 'SCRATCH' | 'DENT' | 'INTERIOR_STAIN' | 'MECHANICAL' | 'TYRE' | 'GLASS' | 'MISSING_ITEM' | 'OTHER';
  photos: string[];
}

export class InspectionService {
  /**
   * Complete Pickup Inspection and hand over vehicle
   */
  static async completePickupInspection(input: PickupInspectionInput) {
    return await dbTransaction(async ({ query }) => {
      // 1. Fetch booking
      const bRes = await query(
        `SELECT b.*, v.odometer_km FROM bookings b
         JOIN vehicles v ON v.id = b.vehicle_id
         WHERE b.id = $1 FOR UPDATE`,
        [input.bookingId]
      );

      if (bRes.rows.length === 0) {
        throw new Error('Booking not found');
      }

      const booking = bRes.rows[0];

      if (booking.status !== 'CONFIRMED' && booking.status !== 'PICKUP_PENDING') {
        throw new Error(`Cannot perform pickup inspection in status '${booking.status}'`);
      }

      if (input.odometerReading < 0) {
        throw new Error('Odometer reading cannot be negative');
      }

      if (input.fuelPercentage < 0 || input.fuelPercentage > 100) {
        throw new Error('Fuel percentage must be between 0 and 100');
      }

      // 2. Insert pickup inspection record
      await query(
        `INSERT INTO pickup_inspections (
           booking_id, inspector_id, customer_id, odometer_reading, fuel_percentage,
           ev_charge_percentage, cleanliness_rating, existing_scratches_notes,
           accessories_verified, inspection_photos, acknowledged_by_customer, customer_acknowledged_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, CURRENT_TIMESTAMP)
         ON CONFLICT (booking_id) DO UPDATE SET
           odometer_reading = EXCLUDED.odometer_reading,
           fuel_percentage = EXCLUDED.fuel_percentage,
           existing_scratches_notes = EXCLUDED.existing_scratches_notes,
           accessories_verified = EXCLUDED.accessories_verified,
           inspection_photos = EXCLUDED.inspection_photos`,
        [
          input.bookingId,
          input.inspectorId,
          booking.customer_id,
          input.odometerReading,
          input.fuelPercentage,
          input.evChargePercentage || null,
          input.cleanlinessRating,
          input.existingScratchesNotes || null,
          JSON.stringify(input.accessoriesVerified),
          JSON.stringify(input.photos),
        ]
      );

      // 3. Update vehicle odometer
      await query(`UPDATE vehicles SET odometer_km = $1 WHERE id = $2`, [input.odometerReading, booking.vehicle_id]);

      // 4. Transition booking status to ACTIVE_RENTAL
      await transitionBookingStatus({
        bookingId: input.bookingId,
        targetStatus: 'ACTIVE_RENTAL',
        actorId: input.inspectorId,
        actorRole: 'OWNER',
        reason: 'Pickup inspection completed and acknowledged. Rental active.',
      });

      return {
        success: true,
        bookingId: input.bookingId,
        status: 'ACTIVE_RENTAL',
        odometer: input.odometerReading,
        fuel: input.fuelPercentage,
      };
    });
  }

  /**
   * Complete Return Inspection, calculate distance / fuel variances, and initiate deposit settlement or damage claim
   */
  static async completeReturnInspection(input: ReturnInspectionInput) {
    return await dbTransaction(async ({ query }) => {
      // 1. Fetch booking, pickup inspection, and price snapshot
      const bRes = await query(
        `SELECT b.*, p.odometer_reading as pickup_odo, p.fuel_percentage as pickup_fuel,
                s.included_km_total, s.extra_km_rate, pr.late_fee_per_hour
         FROM bookings b
         JOIN pickup_inspections p ON p.booking_id = b.id
         JOIN booking_price_snapshots s ON s.booking_id = b.id
         JOIN vehicle_pricing pr ON pr.vehicle_id = b.vehicle_id
         WHERE b.id = $1 FOR UPDATE`,
        [input.bookingId]
      );

      if (bRes.rows.length === 0) {
        throw new Error('Booking or pickup inspection not found');
      }

      const data = bRes.rows[0];

      if (data.status !== 'ACTIVE_RENTAL' && data.status !== 'RETURN_PENDING' && data.status !== 'RETURNED') {
        throw new Error(`Cannot perform return inspection in status '${data.status}'`);
      }

      // VALIDATION: Return odometer MUST be >= pickup odometer
      if (input.odometerReading < data.pickup_odo) {
        throw new Error(
          `Invalid return odometer: ${input.odometerReading} km cannot be less than pickup odometer ${data.pickup_odo} km`
        );
      }

      // Distance calculation
      const usedKm = input.odometerReading - data.pickup_odo;
      const includedKm = data.included_km_total;
      const excessKm = Math.max(0, usedKm - includedKm);
      const excessKmCharge = Number((excessKm * Number(data.extra_km_rate)).toFixed(2));

      // Fuel comparison (charge ₹15 per percent deficit if return fuel is lower than pickup fuel)
      const fuelDeficit = Math.max(0, data.pickup_fuel - input.fuelPercentage);
      const fuelDeficitCharge = Number((fuelDeficit * 15.0).toFixed(2));

      // Late return calculation
      const scheduledEnd = new Date(data.end_time);
      const now = new Date();
      const lateHours = now > scheduledEnd ? Math.ceil((now.getTime() - scheduledEnd.getTime()) / (1000 * 60 * 60)) : 0;
      const lateFee = Number((lateHours * Number(data.late_fee_per_hour)).toFixed(2));

      // Insert return inspection
      await query(
        `INSERT INTO return_inspections (
           booking_id, inspector_id, customer_id, odometer_reading, fuel_percentage,
           ev_charge_percentage, excess_km, excess_km_charge, fuel_deficit_charge,
           late_return_hours, late_return_fee, new_damages_found, damage_notes,
           inspection_photos, acknowledged_by_customer, customer_acknowledged_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, TRUE, CURRENT_TIMESTAMP)
         ON CONFLICT (booking_id) DO UPDATE SET
           odometer_reading = EXCLUDED.odometer_reading,
           excess_km = EXCLUDED.excess_km,
           excess_km_charge = EXCLUDED.excess_km_charge,
           fuel_deficit_charge = EXCLUDED.fuel_deficit_charge,
           new_damages_found = EXCLUDED.new_damages_found,
           damage_notes = EXCLUDED.damage_notes`,
        [
          input.bookingId,
          input.inspectorId,
          data.customer_id,
          input.odometerReading,
          input.fuelPercentage,
          input.evChargePercentage || null,
          excessKm,
          excessKmCharge,
          fuelDeficitCharge,
          lateHours,
          lateFee,
          input.newDamagesFound,
          input.damageNotes || null,
          JSON.stringify(input.photos),
        ]
      );

      // Update vehicle odometer
      await query(`UPDATE vehicles SET odometer_km = $1 WHERE id = $2`, [input.odometerReading, data.vehicle_id]);

      // If damages found, record damage claim
      let claimId: string | null = null;
      if (input.newDamagesFound && input.damageClaimAmount && input.damageClaimAmount > 0) {
        claimId = `clm_${crypto.randomUUID()}`;
        await query(
          `INSERT INTO damage_claims (
             id, booking_id, vehicle_id, owner_id, customer_id, category, description, claimed_amount, status
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN')`,
          [
            claimId,
            input.bookingId,
            data.vehicle_id,
            data.owner_id,
            data.customer_id,
            input.damageCategory || 'OTHER',
            input.damageNotes || 'Damage reported during return inspection',
            input.damageClaimAmount,
          ]
        );
      }

      // Transition booking
      const totalDeductions = excessKmCharge + fuelDeficitCharge + lateFee + (input.damageClaimAmount || 0);

      await transitionBookingStatus({
        bookingId: input.bookingId,
        targetStatus: 'RETURNED',
        actorId: input.inspectorId,
        actorRole: 'OWNER',
        reason: 'Vehicle physically returned and inspected.',
      });

      await transitionBookingStatus({
        bookingId: input.bookingId,
        targetStatus: 'INSPECTION_PENDING',
        actorId: 'SYSTEM',
        actorRole: 'SYSTEM',
        reason: 'Return inspection recorded. Awaiting customer acknowledgment.',
      });

      await transitionBookingStatus({
        bookingId: input.bookingId,
        targetStatus: 'DEPOSIT_PENDING',
        actorId: 'SYSTEM',
        actorRole: 'SYSTEM',
        reason: 'Settlement initiated.',
      });

      return {
        success: true,
        bookingId: input.bookingId,
        usedKm,
        excessKm,
        excessKmCharge,
        fuelDeficitCharge,
        lateFee,
        totalDeductions,
        claimId,
      };
    });
  }
}
