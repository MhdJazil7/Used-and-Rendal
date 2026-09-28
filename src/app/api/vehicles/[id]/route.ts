import { NextRequest } from 'next/server';
import { dbQuery } from '@/lib/db';
import { apiSuccess, apiError, apiNotFound } from '@/lib/api/response';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    const res = await dbQuery(
      `SELECT v.id, v.slug, v.vehicle_type, v.make, v.model, v.variant, v.manufacturing_year,
              v.registration_year, v.fuel_type, v.transmission, v.seat_count, v.colour,
              v.vehicle_category, v.rental_mode, v.district, v.city, v.approximate_area,
              v.features, v.description, v.listing_status, v.eligibility_status,
              p.daily_price, p.weekly_price, p.monthly_price, p.minimum_rental_days,
              p.maximum_rental_days, p.included_km_per_day, p.extra_km_price,
              p.security_deposit, p.cleaning_fee, p.delivery_fee, p.pickup_fee,
              p.late_fee_per_hour, p.fuel_policy, p.outstation_allowed, p.interstate_allowed,
              p.currency,
              r.min_driver_age, r.min_driving_experience_years, r.speed_limit_kmh, r.custom_rules,
              (
                SELECT json_build_object(
                  'display_name', prof.display_name,
                  'is_identity_verified', vr.status = 'VERIFIED'
                )
                FROM profiles prof
                LEFT JOIN verification_records vr ON vr.user_id = prof.id AND vr.verification_type = 'IDENTITY'
                WHERE prof.id = v.owner_id
              ) as owner_info,
              (
                SELECT json_agg(json_build_object(
                  'photo_type', vp.photo_type,
                  'storage_path', vp.storage_path,
                  'is_primary', vp.is_primary
                ))
                FROM vehicle_photos vp
                WHERE vp.vehicle_id = v.id
              ) as photos
       FROM vehicles v
       JOIN vehicle_pricing p ON p.vehicle_id = v.id
       LEFT JOIN vehicle_rules r ON r.vehicle_id = v.id
       WHERE (v.id = $1 OR v.slug = $1)`,
      [id]
    );

    if (res.rows.length === 0) {
      return apiNotFound('Vehicle not found');
    }

    const vehicle = res.rows[0];
    return apiSuccess({ vehicle });
  } catch (err: any) {
    return apiError(err.message, 'VEHICLE_FETCH_ERROR', 500);
  }
}
