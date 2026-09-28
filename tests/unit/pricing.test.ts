import { describe, it, expect } from 'vitest';
import { calculateBookingPrice } from '../../src/lib/pricing/calculator';
import { VehiclePricing } from '../../src/lib/types';

describe('Pricing Engine & Transparent Cost Breakdown', () => {
  const mockPricing: VehiclePricing = {
    vehicle_id: 'veh-test-swift',
    daily_price: 1800.0,
    weekly_price: 11500.0,
    minimum_rental_days: 1,
    maximum_rental_days: 30,
    included_km_per_day: 200,
    extra_km_price: 9.0,
    security_deposit: 3000.0,
    booking_advance_pct: 100,
    cleaning_fee: 150.0,
    delivery_fee: 250.0,
    pickup_fee: 0.0,
    late_fee_per_hour: 150.0,
    fuel_policy: 'SAME_LEVEL',
    outstation_allowed: true,
    interstate_allowed: false,
    currency: 'INR',
  };

  it('calculates 1-day rental accurately with deposit and platform fee', () => {
    const start = '2026-10-01T09:00:00Z';
    const end = '2026-10-02T09:00:00Z';

    const quote = calculateBookingPrice({
      pricing: mockPricing,
      startTime: start,
      endTime: end,
    });

    expect(quote.durationDays).toBe(1);
    expect(quote.rentalAmount).toBe(1800.0);
    expect(quote.includedKmTotal).toBe(200);
    expect(quote.securityDeposit).toBe(3000.0);
    expect(quote.platformFee).toBe(180.0); // 10%
    expect(quote.taxAmount).toBe(32.4);    // 18% of 180
    // Total payable now: 1800 + 180 + 32.4 + 3000 = 5012.40
    expect(quote.totalPayableNow).toBe(5012.4);
    expect(quote.ownerNetExpected).toBe(1620.0); // 1800 - 180
  });

  it('applies weekly pricing tier discount when rental duration >= 7 days', () => {
    const start = '2026-10-01T09:00:00Z';
    const end = '2026-10-08T09:00:00Z'; // 7 days

    const quote = calculateBookingPrice({
      pricing: mockPricing,
      startTime: start,
      endTime: end,
    });

    expect(quote.durationDays).toBe(7);
    // Standard 7 days @ 1800 = 12600. Discounted weekly tier = 11500
    expect(quote.rentalAmount).toBe(11500.0);
    expect(quote.includedKmTotal).toBe(1400); // 7 * 200
  });

  it('rejects rental when duration is below minimum rental days', () => {
    const strictPricing = { ...mockPricing, minimum_rental_days: 3 };
    const start = '2026-10-01T09:00:00Z';
    const end = '2026-10-02T09:00:00Z';

    expect(() => {
      calculateBookingPrice({
        pricing: strictPricing,
        startTime: start,
        endTime: end,
      });
    }).toThrow(/less than the minimum required/);
  });

  it('rejects rental when return date is before or equal to pickup date', () => {
    expect(() => {
      calculateBookingPrice({
        pricing: mockPricing,
        startTime: '2026-10-02T09:00:00Z',
        endTime: '2026-10-01T09:00:00Z',
      });
    }).toThrow(/End time must be strictly after start time/);
  });
});
