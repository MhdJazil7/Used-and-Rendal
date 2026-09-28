import { NextRequest } from 'next/server';
import { AuthService } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';
import { z } from 'zod';
import crypto from 'crypto';

const schema = z.object({
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  description: z.string().min(10),
  dataCategoriesAffected: z.array(z.string()).default([]),
  systemsAffected: z.array(z.string()).default([]),
  containmentActions: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.cookies.get('kvr_session')?.value;
    const session = AuthService.verifySessionToken(authHeader);

    if (!session || (!session.roles.includes('ADMIN') && !session.roles.includes('SUPER_ADMIN'))) {
      return apiForbidden('Admin privileges required');
    }

    const res = await dbQuery(`SELECT * FROM security_incidents ORDER BY detected_at DESC`);
    return apiSuccess({ incidents: res.rows });
  } catch (err: any) {
    return apiError(err.message, 'INCIDENTS_FETCH_ERROR', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.cookies.get('kvr_session')?.value;
    const session = AuthService.verifySessionToken(authHeader);

    if (!session || (!session.roles.includes('ADMIN') && !session.roles.includes('SUPER_ADMIN'))) {
      return apiForbidden('Admin privileges required');
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 'VALIDATION_ERROR', 400);
    }

    const incidentId = `inc_${crypto.randomUUID()}`;
    await dbQuery(
      `INSERT INTO security_incidents (
         id, severity, description, data_categories_affected, systems_affected,
         status, reported_by, containment_actions
       ) VALUES ($1, $2, $3, $4, $5, 'OPEN', $6, $7)`,
      [
        incidentId,
        parsed.data.severity,
        parsed.data.description,
        JSON.stringify(parsed.data.dataCategoriesAffected),
        JSON.stringify(parsed.data.systemsAffected),
        session.userId,
        parsed.data.containmentActions || null,
      ]
    );

    return apiSuccess({ incidentId, status: 'OPEN' }, 201);
  } catch (err: any) {
    return apiError(err.message, 'INCIDENT_CREATE_FAILED', 400);
  }
}
