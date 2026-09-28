import { NextRequest } from 'next/server';
import { AuthService } from '@/lib/auth/session';
import { InspectionService } from '@/lib/inspections/inspectionService';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response';
import { z } from 'zod';

const schema = z.object({
  bookingId: z.string().min(1),
  odometerReading: z.number().int().min(0),
  fuelPercentage: z.number().int().min(0).max(100),
  evChargePercentage: z.number().int().min(0).max(100).optional(),
  newDamagesFound: z.boolean().default(false),
  damageNotes: z.string().optional(),
  damageClaimAmount: z.number().min(0).optional(),
  damageCategory: z.enum(['SCRATCH', 'DENT', 'INTERIOR_STAIN', 'MECHANICAL', 'TYRE', 'GLASS', 'MISSING_ITEM', 'OTHER']).optional(),
  photos: z.array(z.string()).default([]),
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

    const result = await InspectionService.completeReturnInspection({
      bookingId: parsed.data.bookingId,
      inspectorId: session.userId,
      odometerReading: parsed.data.odometerReading,
      fuelPercentage: parsed.data.fuelPercentage,
      evChargePercentage: parsed.data.evChargePercentage,
      newDamagesFound: parsed.data.newDamagesFound,
      damageNotes: parsed.data.damageNotes,
      damageClaimAmount: parsed.data.damageClaimAmount,
      damageCategory: parsed.data.damageCategory,
      photos: parsed.data.photos,
    });

    return apiSuccess(result);
  } catch (err: any) {
    return apiError(err.message, 'RETURN_INSPECTION_FAILED', 400);
  }
}
