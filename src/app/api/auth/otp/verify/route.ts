import { NextRequest } from 'next/server';
import { AuthService } from '@/lib/auth/session';
import { apiSuccess, apiError } from '@/lib/api/response';
import { z } from 'zod';

const schema = z.object({
  phone: z.string().min(10),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 'VALIDATION_ERROR', 400);
    }

    const { sessionToken, user } = await AuthService.verifyOtp(parsed.data.phone, parsed.data.otp);

    // Respond with session and set HTTP-only cookie for browser navigation
    const res = apiSuccess({ user, sessionToken });
    res.cookies.set('kvr_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60,
    });

    return res;
  } catch (err: any) {
    return apiError(err.message, 'AUTH_VERIFY_ERROR', 400);
  }
}
