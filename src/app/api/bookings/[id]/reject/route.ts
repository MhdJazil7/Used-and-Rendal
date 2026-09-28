import { NextRequest } from 'next/server';
import { AuthService } from '@/lib/auth/session';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response';
import { transitionBookingStatus } from '@/lib/booking/stateMachine';
import { z } from 'zod';

const schema = z.object({
  reason: z.string().min(3, 'Rejection reason is required'),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

    const { id } = params;

    const result = await transitionBookingStatus({
      bookingId: id,
      targetStatus: 'OWNER_REJECTED',
      actorId: session.userId,
      actorRole: 'OWNER',
      reason: parsed.data.reason,
    });

    return apiSuccess({
      success: true,
      bookingId: id,
      status: 'OWNER_REJECTED',
      reason: parsed.data.reason,
    });
  } catch (err: any) {
    return apiError(err.message, 'REJECT_BOOKING_FAILED', 400);
  }
}
