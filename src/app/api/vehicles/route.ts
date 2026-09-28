import { NextRequest } from 'next/server';
import { dbQuery, dbTransaction } from '@/lib/db';
import { apiSuccess, apiError, apiUnauthorized } from '@/lib/api/response';
import { AuthService } from '@/lib/auth/session';
import { z } from 'zod';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const district = searchParams.get('district');
    const vehicleType = searchParams.get('vehicleType');
    const fuelType = searchParams.get('fuelType');
    const transmission = searchParams.get('transmission');
    const minSeats = searchParams.get('minSeats');
    const maxDailyPrice = searchParams.get('maxDailyPrice');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12', 10)));
    const offset = (page - 1) * limit;

    let sql = `
      SELECT v.id, v.slug, v.vehicle_type, v.make, v.model, v.variant, v.manufacturing_year,
             v.fuel_type, v.transmission, v.seat_count, v.colour, v.vehicle_category,
             v.rental_mode, v.district, v.city, v.approximate_area, v.features,
             p.daily_price, p.weekly_price, p.included_km_per_day, p.extra_km_price,
             p.security_deposit, p.cleaning_fee, p.delivery_fee, p.fuel_policy,
             p.outstation_allowed, p.interstate_allowed, p.currency,
             r.min_driver_age, r.min_driving_experience_years, r.speed_limit_kmh,
             (
               SELECT json_build_object(
                 'owner_verified', vr.status = 'VERIFIED',
                 'display_name', prof.display_name
               )
               FROM profiles prof
               LEFT JOIN verification_records vr ON vr.user_id = prof.id AND vr.verification_type = 'IDENTITY'
               WHERE prof.id = v.owner_id
             ) as owner_info
      FROM vehicles v
      JOIN vehicle_pricing p ON p.vehicle_id = v.id
      LEFT JOIN vehicle_rules r ON r.vehicle_id = v.id
      WHERE v.listing_status = 'LIVE' 
        AND v.eligibility_status = 'ELIGIBLE'
    `;

    const params: any[] = [];
    let pIdx = 1;

    if (district && district !== 'All Kerala') {
      sql += ` AND LOWER(v.district) = LOWER($${pIdx++})`;
      params.push(district);
    }

    if (vehicleType && vehicleType !== 'ALL') {
      sql += ` AND v.vehicle_type = $${pIdx++}`;
      params.push(vehicleType);
    }

    if (fuelType && fuelType !== 'ALL') {
      sql += ` AND v.fuel_type = $${pIdx++}`;
      params.push(fuelType);
    }

    if (transmission && transmission !== 'ALL') {
      sql += ` AND v.transmission = $${pIdx++}`;
      params.push(transmission);
    }

    if (minSeats) {
      sql += ` AND v.seat_count >= $${pIdx++}`;
      params.push(parseInt(minSeats, 10));
    }

    if (maxDailyPrice) {
      sql += ` AND p.daily_price <= $${pIdx++}`;
      params.push(parseFloat(maxDailyPrice));
    }

    sql += ` ORDER BY v.created_at DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`;
    params.push(limit, offset);

    const result = await dbQuery(sql, params);

    return apiSuccess({
      vehicles: result.rows,
      page,
      limit,
      count: result.rows.length,
    });
  } catch (err: any) {
    return apiError(err.message, 'SEARCH_ERROR', 500);
  }
}

const createVehicleSchema = z.object({
  vehicleType: z.enum(['CAR', 'SUV', 'MUV', 'HATCHBACK', 'SEDAN', 'TWO_WHEELER', 'VAN']),
  make: z.string().min(2),
  model: z.string().min(1),
  variant: z.string().optional(),
  manufacturingYear: z.number().int().min(2005).max(2027),
  registrationYear: z.number().int().min(2005).max(2027),
  fuelType: z.enum(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG']),
  transmission: z.enum(['MANUAL', 'AUTOMATIC']),
  seatCount: z.number().int().min(1).max(20),
  colour: z.string().min(2),
  odometerKm: z.number().int().min(0),
  vehicleCategory: z.enum(['COMMERCIAL_RENTAL', 'COMMERCIAL_TOURIST', 'PRIVATE_SELF_DRIVE']),
  rentalMode: z.enum(['SELF_DRIVE', 'WITH_DRIVER']),
  registrationNumber: z.string().min(6), // e.g. KL 07 CZ 1234
  registeredOwnerName: z.string().min(2),
  district: z.string().min(2),
  city: z.string().min(2),
  approximateArea: z.string().min(2),
  features: z.array(z.string()).default([]),
  description: z.string().optional(),
  dailyPrice: z.number().positive(),
  weeklyPrice: z.number().positive().optional(),
  securityDeposit: z.number().min(0),
  includedKmPerDay: z.number().int().min(50),
  extraKmPrice: z.number().min(0),
});

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.cookies.get('kvr_session')?.value;
    const session = AuthService.verifySessionToken(authHeader);

    if (!session) {
      return apiUnauthorized('You must be logged in to list a vehicle');
    }

    const body = await req.json();
    const parsed = createVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.errors[0].message, 'VALIDATION_ERROR', 400);
    }

    const data = parsed.data;
    const vehicleId = `veh_${crypto.randomUUID()}`;
    const slug = `${data.make.toLowerCase()}-${data.model.toLowerCase()}-${data.city.toLowerCase()}-${crypto.randomBytes(3).toString('hex')}`.replace(/\s+/g, '-');

    // Hash and mask registration number
    const regClean = data.registrationNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const regHash = crypto.createHash('sha256').update(regClean).digest('hex');
    const regMasked = regClean.slice(0, 4) + '-**-' + regClean.slice(-4);

    const created = await dbTransaction(async ({ query }) => {
      // 1. Ensure user has OWNER role assigned
      const roleCheck = await query(
        `SELECT id FROM user_roles WHERE user_id = $1 AND role IN ('OWNER', 'RENTAL_BUSINESS_OWNER', 'ADMIN', 'SUPER_ADMIN')`,
        [session.userId]
      );

      if (roleCheck.rows.length === 0) {
        await query(
          `INSERT INTO user_roles (id, user_id, role) VALUES ($1, $2, 'OWNER') ON CONFLICT DO NOTHING`,
          [`role_${crypto.randomUUID()}`, session.userId]
        );
      }

      // 2. Insert vehicle (starts in DRAFT and PENDING_MANUAL_REVIEW for safety)
      await query(
        `INSERT INTO vehicles (
           id, owner_id, slug, vehicle_type, make, model, variant,
           manufacturing_year, registration_year, fuel_type, transmission,
           seat_count, colour, odometer_km, vehicle_category, rental_mode,
           registration_state, registration_number_hash, registration_number_masked,
           registered_owner_name, owner_relationship, district, city,
           approximate_area, features, description, listing_status, eligibility_status
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
           'KL', $17, $18, $19, 'REGISTERED_OWNER', $20, $21, $22, $23, $24, 'UNDER_REVIEW', 'PENDING_MANUAL_REVIEW'
         )`,
        [
          vehicleId,
          session.userId,
          slug,
          data.vehicleType,
          data.make,
          data.model,
          data.variant || null,
          data.manufacturingYear,
          data.registrationYear,
          data.fuelType,
          data.transmission,
          data.seatCount,
          data.colour,
          data.odometerKm,
          data.vehicleCategory,
          data.rentalMode,
          regHash,
          regMasked,
          data.registeredOwnerName,
          data.district,
          data.city,
          data.approximateArea,
          JSON.stringify(data.features),
          data.description || null,
        ]
      );

      // 3. Insert pricing
      await query(
        `INSERT INTO vehicle_pricing (
           vehicle_id, daily_price, weekly_price, minimum_rental_days, maximum_rental_days,
           included_km_per_day, extra_km_price, security_deposit, booking_advance_pct
         ) VALUES ($1, $2, $3, 1, 30, $4, $5, $6, 100)`,
        [
          vehicleId,
          data.dailyPrice,
          data.weeklyPrice || null,
          data.includedKmPerDay,
          data.extraKmPrice,
          data.securityDeposit,
        ]
      );

      return { vehicleId, slug, status: 'UNDER_REVIEW' };
    });

    return apiSuccess(created, 201);
  } catch (err: any) {
    return apiError(err.message, 'CREATE_VEHICLE_ERROR', 400);
  }
}
