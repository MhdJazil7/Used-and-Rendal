import { NextRequest } from 'next/server';
import { dbQuery } from '@/lib/db';
import { AuthService } from '@/lib/auth/session';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response';
import { createBookingRequest } from '@/lib/booking/concurrency';
import { z } from 'zod';

const createBookingSchema = z.object({
  vehicleId: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  pickupLocationApprox: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.cookies.get('kvr_session')?.value;
    const session = AuthService.verifySessionToken(authHeader);

    if (!session) {
      return apiUnauthorized('You must be logged in to view your bookings');
    }

    const { searchParams } = new URL(req.url);
    const roleView = searchParams.get('role'); // 'owner' or 'customer'

    let sql = `
      SELECT b.id, b.booking_reference, b.vehicle_id, b.customer_id, b.owner_id,
             b.start_time, b.end_time, b.pickup_location_approx, b.status,
             b.payment_deadline, b.created_at, b.rejection_reason,
             v.make, v.model, v.variant, v.seat_count, v.transmission, v.fuel_type,
             s.total_payable_now, s.rental_amount, s.security_deposit, s.currency,
             (
               SELECT json_build_object('display_name', prof.display_name, 'phone', prof.phone)
               FROM profiles prof WHERE prof.id = b.customer_id
             ) as customer_info,
             (
               SELECT json_build_object('display_name', prof.display_name, 'phone', prof.phone)
               FROM profiles prof WHERE prof.id = b.owner_id
             ) as owner_info
      FROM bookings b
      JOIN vehicles v ON v.id = b.vehicle_id
      LEFT JOIN booking_price_snapshots s ON s.booking_id = b.id
    `;

    if (roleView === 'owner') {
      sql += ` WHERE b.owner_id = $1 ORDER BY b.created_at DESC`;
    } else {
      sql += ` WHERE b.customer_id = $1 ORDER BY b.created_at DESC`;
    }

    const result = await dbQuery(sql, [session.userId]);
    return apiSuccess({ bookings: result.rows });
  } catch (err: any) {
    return apiError(err.message, 'BOOKINGS_FETCH_ERROR', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.cookies.get('kvr_session')?.value;
    const session = AuthService.verifySessionToken(authHeader);

    if (!session) {
      return apiUnauthorized('You must be logged in to request a rental booking');
    }

    const body = await req.json();
    const parsed = createBookingSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 'VALIDATION_ERROR', 400);
    }

    const result = await createBookingRequest({
      vehicleId: parsed.data.vehicleId,
      customerId: session.userId,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      pickupLocationApprox: parsed.data.pickupLocationApprox || 'Kochi Area',
    });

    return apiSuccess(result, 201);
  } catch (err: any) {
    return apiError(err.message, 'BOOKING_REQUEST_FAILED', 400);
  }
}
