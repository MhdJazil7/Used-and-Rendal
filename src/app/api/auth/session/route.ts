import { NextRequest } from 'next/server';
import { AuthService } from '@/lib/auth/session';
import { apiSuccess, apiUnauthorized } from '@/lib/api/response';

export async function GET(req: NextRequest) {
  // Check cookie or Authorization header
  const authHeader = req.headers.get('authorization');
  const cookieToken = req.cookies.get('kvr_session')?.value;
  const token = authHeader || cookieToken;

  const session = AuthService.verifySessionToken(token);
  if (!session) {
    return apiUnauthorized('Active session not found or expired');
  }

  return apiSuccess({ user: session });
}
