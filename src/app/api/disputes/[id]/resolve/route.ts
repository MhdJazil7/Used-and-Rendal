import { NextRequest } from 'next/server';
import { AuthService } from '@/lib/auth/session';
import { DisputeService } from '@/lib/disputes/disputeService';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { z } from 'zod';

const schema = z.object({
  resolutionNotes: z.string().min(5),
  depositAction: z.enum(['REFUND_FULL', 'PARTIAL_TO_OWNER', 'FULL_TO_OWNER', 'NO_ACTION']),
  ownerSettlementAmount: z.number().min(0).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get('authorization') || req.cookies.get('kvr_session')?.value;
    const session = AuthService.verifySessionToken(authHeader);

    if (!session) {
      return apiUnauthorized('Authentication required');
    }

    if (!session.roles.includes('ADMIN') && !session.roles.includes('SUPER_ADMIN') && !session.roles.includes('SUPPORT_STAFF')) {
      return apiForbidden('Only authorized staff or administrators can resolve formal disputes');
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 'VALIDATION_ERROR', 400);
    }

    const result = await DisputeService.resolveDispute({
      disputeId: params.id,
      staffId: session.userId,
      resolutionNotes: parsed.data.resolutionNotes,
      depositAction: parsed.data.depositAction,
      ownerSettlementAmount: parsed.data.ownerSettlementAmount,
    });

    return apiSuccess(result);
  } catch (err: any) {
    return apiError(err.message, 'RESOLVE_DISPUTE_FAILED', 400);
  }
}
