import { NextRequest } from 'next/server';
import { AuthService } from '@/lib/auth/session';
import { PaymentService } from '@/lib/payments/paymentService';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response';
import { z } from 'zod';

const schema = z.object({
  bookingId: z.string().min(1),
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

    // Creates payment order strictly using server-stored snapshot! Never takes amount from client.
    const result = await PaymentService.createOrderForBooking(parsed.data.bookingId, session.userId);
    return apiSuccess(result);
  } catch (err: any) {
    return apiError(err.message, 'PAYMENT_ORDER_CREATION_FAILED', 400);
  }
}
