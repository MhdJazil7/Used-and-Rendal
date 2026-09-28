import { NextRequest } from 'next/server';
import { AuthService } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.cookies.get('kvr_session')?.value;
    const session = AuthService.verifySessionToken(authHeader);

    if (!session) {
      return apiUnauthorized('Authentication required');
    }

    // Return user's consents and privacy requests
    const consents = await dbQuery(
      `SELECT purpose, policy_version, granted_at, withdrawn_at FROM user_consents WHERE user_id = $1`,
      [session.userId]
    );

    const requests = await dbQuery(
      `SELECT id, request_type, status, requested_at, resolved_at FROM privacy_requests WHERE user_id = $1 ORDER BY requested_at DESC`,
      [session.userId]
    );

    const verificationInfo = await dbQuery(
      `SELECT verification_type, status, verified_at, expires_at FROM verification_records WHERE user_id = $1`,
      [session.userId]
    );

    return apiSuccess({
      userId: session.userId,
      consents: consents.rows,
      privacyRequests: requests.rows,
      verificationSummary: verificationInfo.rows,
    });
  } catch (err: any) {
    return apiError(err.message, 'PRIVACY_FETCH_FAILED', 500);
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
    const requestType = body.requestType; // 'ACCESS_EXPORT' | 'DELETION'

    if (requestType !== 'ACCESS_EXPORT' && requestType !== 'DELETION') {
      return apiError('Invalid privacy request type', 'VALIDATION_ERROR', 400);
    }

    // Check legal hold / active dispute before deletion request
    if (requestType === 'DELETION') {
      const holdRes = await dbQuery(`SELECT id FROM legal_holds WHERE user_id = $1 AND released_at IS NULL`, [
        session.userId,
      ]);
      if (holdRes.rows.length > 0) {
        return apiError(
          'Your account currently has an active legal hold / active booking dispute and cannot be purged until statutory proceedings conclude.',
          'LEGAL_HOLD_ACTIVE',
          409
        );
      }
    }

    const reqId = `prq_${crypto.randomUUID()}`;
    await dbQuery(
      `INSERT INTO privacy_requests (id, user_id, request_type, status, reason)
       VALUES ($1, $2, $3, 'PENDING', $4)`,
      [reqId, session.userId, requestType, body.reason || 'User initiated from Privacy Center']
    );

    return apiSuccess({
      requestId: reqId,
      status: 'PENDING',
      message: `Your ${requestType} request has been submitted and will be processed within statutory timelines.`,
    });
  } catch (err: any) {
    return apiError(err.message, 'PRIVACY_REQUEST_FAILED', 400);
  }
}
