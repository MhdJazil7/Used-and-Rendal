import { NextRequest } from 'next/server';
import { AuthService } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/response';
import { z } from 'zod';

const schema = z.object({
  phone: z.string().min(10, 'Valid 10-digit mobile number required').max(15),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 'VALIDATION_ERROR', 400);
    }

    const result = await AuthService.requestOtp(parsed.data.phone);
    return apiSuccess(result);
  } catch (err: any) {
    return apiError(err.message, 'AUTH_ERROR', 400);
  }
}
