import { NextRequest } from 'next/server';
import { dbQuery } from '@/lib/db';
import { AuthService } from '@/lib/auth/session';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden, apiNotFound } from '@/lib/api/response';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get('authorization') || req.cookies.get('kvr_session')?.value;
    const session = AuthService.verifySessionToken(authHeader);

    if (!session) {
      return apiUnauthorized('Authentication required');
    }

    const { id } = params;

    const res = await dbQuery(
      `SELECT b.*, 
              v.make, v.model, v.variant, v.seat_count, v.transmission, v.fuel_type, v.district, v.city,
              s.rental_amount, s.platform_fee, s.security_deposit, s.tax_amount, s.delivery_fee,
              s.included_km_total, s.extra_km_rate, s.total_payable_now, s.currency,
              p.inspector_id as pickup_inspector, p.odometer_reading as pickup_odometer, p.fuel_percentage as pickup_fuel,
              r.odometer_reading as return_odometer, r.fuel_percentage as return_fuel, r.excess_km, r.excess_km_charge,
              dep.status as deposit_status, dep.amount_held as deposit_amount_held, dep.amount_refunded as deposit_refunded,
              (
                SELECT json_build_object(
                  'display_name', prof.display_name,
                  'is_identity_verified', vr.status = 'VERIFIED'
                )
                FROM profiles prof
                LEFT JOIN verification_records vr ON vr.user_id = prof.id AND vr.verification_type = 'IDENTITY'
                WHERE prof.id = b.customer_id
              ) as customer_info,
              (
                SELECT json_build_object('display_name', prof.display_name, 'phone', prof.phone)
                FROM profiles prof WHERE prof.id = b.owner_id
              ) as owner_info
       FROM bookings b
       JOIN vehicles v ON v.id = b.vehicle_id
       LEFT JOIN booking_price_snapshots s ON s.booking_id = b.id
       LEFT JOIN pickup_inspections p ON p.booking_id = b.id
       LEFT JOIN return_inspections r ON r.booking_id = b.id
       LEFT JOIN deposits dep ON dep.booking_id = b.id
       WHERE b.id = $1 OR b.booking_reference = $1`,
      [id]
    );

    if (res.rows.length === 0) {
      return apiNotFound('Booking not found');
    }

    const booking = res.rows[0];

    // Authorization check: Customer, Owner, or Admin
    const isCustomer = booking.customer_id === session.userId;
    const isOwner = booking.owner_id === session.userId;
    const isAdmin = session.roles.includes('ADMIN') || session.roles.includes('SUPER_ADMIN');

    if (!isCustomer && !isOwner && !isAdmin) {
      return apiForbidden('You are not authorized to view this booking');
    }

    return apiSuccess({ booking });
  } catch (err: any) {
    return apiError(err.message, 'BOOKING_FETCH_ERROR', 500);
  }
}
