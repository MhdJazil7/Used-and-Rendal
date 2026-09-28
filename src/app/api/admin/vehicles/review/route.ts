import { NextRequest } from 'next/server';
import { AuthService } from '@/lib/auth/session';
import { dbQuery, dbTransaction } from '@/lib/db';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { logAuditEvent } from '@/lib/security/auditLogger';
import { z } from 'zod';

const schema = z.object({
  vehicleId: z.string().min(1),
  action: z.enum(['APPROVE', 'REJECT', 'SUSPEND']),
  notes: z.string().optional(),
});

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

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 'VALIDATION_ERROR', 400);
    }

    const { vehicleId, action, notes } = parsed.data;

    let listingStatus = 'UNDER_REVIEW';
    let eligibilityStatus = 'PENDING_MANUAL_REVIEW';

    if (action === 'APPROVE') {
      listingStatus = 'LIVE';
      eligibilityStatus = 'ELIGIBLE';
    } else if (action === 'REJECT') {
      listingStatus = 'ARCHIVED';
      eligibilityStatus = 'INELIGIBLE';
    } else if (action === 'SUSPEND') {
      listingStatus = 'SUSPENDED';
      eligibilityStatus = 'SUSPENDED';
    }

    await dbQuery(
      `UPDATE vehicles SET 
         listing_status = $1, 
         eligibility_status = $2, 
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [listingStatus, eligibilityStatus, vehicleId]
    );

    await logAuditEvent({
      actorId: session.userId,
      actorRole: session.primaryRole,
      action: `VEHICLE_${action}`,
      resourceType: 'VEHICLE',
      resourceId: vehicleId,
      details: { notes, listingStatus, eligibilityStatus },
    });

    return apiSuccess({
      success: true,
      vehicleId,
      listingStatus,
      eligibilityStatus,
    });
  } catch (err: any) {
    return apiError(err.message, 'VEHICLE_REVIEW_FAILED', 400);
  }
}
