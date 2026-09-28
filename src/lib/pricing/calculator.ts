import { VehiclePricing, BookingPriceQuote } from '../types';

export interface PriceCalculationInput {
  pricing: VehiclePricing;
  startTime: Date | string;
  endTime: Date | string;
  deliveryRequested?: boolean;
  platformCommissionPct?: number; // Default 10%
  taxRatePct?: number; // E.g. 18% GST on platform service fee
}

export function calculateBookingPrice(input: PriceCalculationInput): BookingPriceQuote {
  const start = new Date(input.startTime);
  const end = new Date(input.endTime);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid start or end date format');
  }

  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) {
    throw new Error('End time must be strictly after start time');
  }

  // Calculate rental duration in days (minimum 1 day, rounding up full or partial 24h blocks)
  const diffHours = diffMs / (1000 * 60 * 60);
  const durationDays = Math.max(1, Math.ceil(diffHours / 24));

  const pricing = input.pricing;

  if (durationDays < pricing.minimum_rental_days) {
    throw new Error(`Rental duration (${durationDays} days) is less than the minimum required (${pricing.minimum_rental_days} days)`);
  }

  if (durationDays > pricing.maximum_rental_days) {
    throw new Error(`Rental duration (${durationDays} days) exceeds maximum allowed (${pricing.maximum_rental_days} days)`);
  }

  // Base rental calculation
  let rentalAmount = pricing.daily_price * durationDays;

  // Weekly pricing tier discount if configured and booking is >= 7 days
  if (pricing.weekly_price && durationDays >= 7) {
    const fullWeeks = Math.floor(durationDays / 7);
    const extraDays = durationDays % 7;
    const weeklyRatePerDay = pricing.weekly_price / 7;
    rentalAmount = (fullWeeks * pricing.weekly_price) + (extraDays * weeklyRatePerDay);
  }

  rentalAmount = Number(rentalAmount.toFixed(2));

  // Platform commission
  const commissionRate = (input.platformCommissionPct ?? 10) / 100;
  const platformFee = Number((rentalAmount * commissionRate).toFixed(2));

  // Taxes (GST on platform service fee)
  const taxRate = (input.taxRatePct ?? 18) / 100;
  const taxAmount = Number((platformFee * taxRate).toFixed(2));

  // Delivery fee
  const deliveryFee = input.deliveryRequested ? Number(pricing.delivery_fee.toFixed(2)) : 0.00;

  // Security deposit
  const securityDeposit = Number(pricing.security_deposit.toFixed(2));

  // Total payable by customer upfront
  const totalPayableNow = Number((rentalAmount + platformFee + taxAmount + deliveryFee + securityDeposit).toFixed(2));

  // Owner net earnings expected (Rental revenue minus platform commission + delivery fee)
  const ownerNetExpected = Number((rentalAmount - platformFee + deliveryFee).toFixed(2));

  // Included kilometers total
  const includedKmTotal = pricing.included_km_per_day * durationDays;

  return {
    durationDays,
    dailyRate: pricing.daily_price,
    rentalAmount,
    includedKmTotal,
    extraKmRate: pricing.extra_km_price,
    securityDeposit,
    platformFee,
    taxAmount,
    deliveryFee,
    discountAmount: 0.00,
    totalPayableNow,
    ownerNetExpected,
    currency: pricing.currency || 'INR',
    policyVersion: '2026.1-kerala',
  };
}
