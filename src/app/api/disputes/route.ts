import { NextRequest } from 'next/server';
import { dbQuery } from '@/lib/db';
import { AuthService } from '@/lib/auth/session';
import { DisputeService } from '@/lib/disputes/disputeService';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response';
import { z } from 'zod';

const schema = z.object({
  bookingId: z.string().min(1),
  category: z.enum([
    'DAMAGE', 'PAYMENT', 'DEPOSIT', 'REFUND', 'CANCELLATION', 'VEHICLE_CONDITION', 'VEHICLE_NOT_AS_DESCRIBED', 'PICKUP', 'RETURN', 'OTHER'
  ]),
  description: z.string().min(10, 'Please describe the dispute reason in detail'),
});

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.cookies.get('kvr_session')?.value;
    const session = AuthService.verifySessionToken(authHeader);

    if (!session) {
      return apiUnauthorized('Authentication required');
    }

    const { searchParams } = new URL(req.url);
    const bookingId = searchParams.get('bookingId');

    let sql = `
      SELECT d.*, b.booking_reference, b.vehicle_id, b.customer_id, b.owner_id
      FROM disputes d
      JOIN bookings b ON b.id = d.booking_id
    `;
    const params: any[] = [];

    if (bookingId) {
      sql += ` WHERE d.booking_id = $1`;
      params.push(bookingId);
    } else if (!session.roles.includes('ADMIN') && !session.roles.includes('SUPER_ADMIN')) {
      sql += ` WHERE (b.customer_id = $1 OR b.owner_id = $1)`;
      params.push(session.userId);
    }

    sql += ` ORDER BY d.created_at DESC`;

    const res = await dbQuery(sql, params);
    return apiSuccess({ disputes: res.rows });
  } catch (err: any) {
    return apiError(err.message, 'DISPUTES_FETCH_FAILED', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.cookies.get('kvr_session')?.value;
    const session = AuthService.verifySessionToken(authHeader);

    if (!session) {
      return apiUnauthorized('Authentication required');
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 'VALIDATION_ERROR', 400);
    }

    const result = await DisputeService.openDispute({
      bookingId: parsed.data.bookingId,
      initiatedBy: session.userId,
      category: parsed.data.category,
      description: parsed.data.description,
    });

    return apiSuccess(result, 201);
  } catch (err: any) {
    return apiError(err.message, 'OPEN_DISPUTE_FAILED', 400);
  }
}
