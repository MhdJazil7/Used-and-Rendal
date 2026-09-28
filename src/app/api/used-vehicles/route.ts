import { NextRequest } from 'next/server';
import { dbQuery } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(req: NextRequest) {
  const isEnabled = process.env.FEATURE_USED_SALES_ENABLED === 'true';

  if (!isEnabled) {
    return apiSuccess({
      enabled: false,
      message: 'Used vehicle marketplace module is currently disabled by system configuration',
      listings: [],
    });
  }

  try {
    const res = await dbQuery(`
      SELECT s.*, p.display_name as seller_name
      FROM sale_listings s
      JOIN profiles p ON p.id = s.seller_id
      WHERE s.listing_status = 'LIVE'
      ORDER BY s.created_at DESC
    `);

    return apiSuccess({
      enabled: true,
      listings: res.rows,
    });
  } catch (err: any) {
    return apiError(err.message, 'USED_SALES_ERROR', 500);
  }
}
