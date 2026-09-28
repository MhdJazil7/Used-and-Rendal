import { NextRequest } from 'next/server';
import { AuthService } from '@/lib/auth/session';
import { PaymentService } from '@/lib/payments/paymentService';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { dbQuery } from '@/lib/db';
import { z } from 'zod';

const schema = z.object({
  bookingId: z.string().min(1),
  deductionAmount: z.number().min(0).default(0),
  reason: z.string().min(3).default('Return inspection completed without damages'),
});

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

    // Verify booking ownership
    const bRes = await dbQuery(
      `SELECT owner_id, status FROM bookings WHERE id = $1`,
      [parsed.data.bookingId]
    );

    if (bRes.rows.length === 0) {
      return apiError('Booking not found', 'NOT_FOUND', 404);
    }

    const booking = bRes.rows[0];
    const isOwner = booking.owner_id === session.userId;
    const isAdmin = session.roles.includes('ADMIN') || session.roles.includes('SUPER_ADMIN');

    if (!isOwner && !isAdmin) {
      return apiForbidden('Only the vehicle owner or administrator can settle deposits');
    }

    const result = await PaymentService.settleDeposit(
      parsed.data.bookingId,
      parsed.data.deductionAmount,
      parsed.data.reason
    );

    return apiSuccess(result);
  } catch (err: any) {
    return apiError(err.message, 'SETTLE_DEPOSIT_FAILED', 400);
  }
}
