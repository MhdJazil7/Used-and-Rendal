import { NextRequest } from 'next/server';
import { AuthService } from '@/lib/auth/session';
import { RetentionEngine } from '@/lib/retention/retentionWorker';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.cookies.get('kvr_session')?.value;
    const session = AuthService.verifySessionToken(authHeader);

    if (!session) {
      return apiUnauthorized('Authentication required');
    }

    if (!session.roles.includes('ADMIN') && !session.roles.includes('SUPER_ADMIN')) {
      return apiForbidden('Administrative privileges required');
    }

    const result = await RetentionEngine.runRetentionSweep();
    return apiSuccess(result);
  } catch (err: any) {
    return apiError(err.message, 'RETENTION_SWEEP_FAILED', 500);
  }
}
