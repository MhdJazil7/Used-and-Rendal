import { NextRequest } from 'next/server';
import { AuthService } from '@/lib/auth/session';
import { PaymentService } from '@/lib/payments/paymentService';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response';
import { z } from 'zod';

const schema = z.object({
  orderDbId: z.string().min(1),
  providerPaymentId: z.string().min(1),
  providerSignature: z.string().min(1),
  paymentMethod: z.string().optional(),
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

    const result = await PaymentService.confirmPayment({
      orderDbId: parsed.data.orderDbId,
      providerPaymentId: parsed.data.providerPaymentId,
      providerSignature: parsed.data.providerSignature,
      paymentMethod: parsed.data.paymentMethod,
    });

    return apiSuccess(result);
  } catch (err: any) {
    return apiError(err.message, 'PAYMENT_VERIFICATION_FAILED', 400);
  }
}
