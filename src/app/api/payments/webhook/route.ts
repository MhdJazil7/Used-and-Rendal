import { NextRequest } from 'next/server';
import { PaymentService } from '@/lib/payments/paymentService';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((val, key) => {
      headers[key.toLowerCase()] = val;
    });

    const result = await PaymentService.handleWebhook(rawBody, headers);
    return apiSuccess(result);
  } catch (err: any) {
    console.error('Webhook error:', err);
    return apiError(err.message, 'WEBHOOK_FAILED', 400);
  }
}
