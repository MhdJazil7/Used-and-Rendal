// Core TypeScript Type Definitions for Kerala Vehicle Rental Marketplace

export type UserRole = 
  | 'CUSTOMER'
  | 'OWNER'
  | 'RENTAL_BUSINESS_OWNER'
  | 'SUPPORT_STAFF'
  | 'VERIFICATION_STAFF'
  | 'ADMIN'
  | 'SUPER_ADMIN';

export type BookingStatus =
  | 'DRAFT'
  | 'REQUESTED'
  | 'OWNER_ACCEPTED'
  | 'OWNER_REJECTED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_FAILED'
  | 'CONFIRMED'
  | 'PICKUP_PENDING'
  | 'ACTIVE_RENTAL'
  | 'RETURN_PENDING'
  | 'RETURNED'
  | 'INSPECTION_PENDING'
  | 'DEPOSIT_PENDING'
  | 'DEPOSIT_PARTIAL_REFUND'
  | 'DEPOSIT_REFUNDED'
  | 'COMPLETED'
  | 'CUSTOMER_CANCELLED'
  | 'OWNER_CANCELLED'
  | 'EXPIRED'
  | 'DISPUTED'
  | 'ADMIN_SUSPENDED';

export type FuelPolicy = 'FULL_TO_FULL' | 'SAME_LEVEL' | 'CUSTOM';

export type RentalMode = 'SELF_DRIVE' | 'WITH_DRIVER';

export type VehicleCategory = 'COMMERCIAL_RENTAL' | 'COMMERCIAL_TOURIST' | 'PRIVATE_SELF_DRIVE';

export interface Profile {
  id: string;
  phone: string;
  email?: string;
  full_name: string;
  display_name?: string;
  avatar_url?: string;
  address_district: string;
  address_city?: string;
  address_approx_area?: string;
  preferred_language: 'en' | 'ml';
  is_active: boolean;
  created_at: string;
}

export interface Vehicle {
  id: string;
  owner_id: string;
  slug: string;
  vehicle_type: 'CAR' | 'SUV' | 'MUV' | 'HATCHBACK' | 'SEDAN' | 'TWO_WHEELER' | 'VAN';
  make: string;
  model: string;
  variant?: string;
  manufacturing_year: number;
  registration_year: number;
  fuel_type: 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'CNG';
  transmission: 'MANUAL' | 'AUTOMATIC';
  seat_count: number;
  colour: string;
  odometer_km: number;
  vehicle_category: VehicleCategory;
  rental_mode: RentalMode;
  registration_state: string;
  registration_number_masked: string;
  registered_owner_name: string;
  owner_relationship: string;
  district: string;
  city: string;
  approximate_area: string;
  features: string[];
  description?: string;
  listing_status: 'DRAFT' | 'UNDER_REVIEW' | 'LIVE' | 'PAUSED' | 'SUSPENDED' | 'EXPIRED' | 'ARCHIVED';
  eligibility_status: 'ELIGIBLE' | 'PENDING_MANUAL_REVIEW' | 'REQUIRES_DOCUMENTS' | 'INELIGIBLE' | 'SUSPENDED';
  is_instant_book_enabled: boolean;
  created_at: string;
  // Included pricing if joined
  pricing?: VehiclePricing;
}

export interface VehiclePricing {
  vehicle_id: string;
  daily_price: number;
  weekly_price?: number;
  monthly_price?: number;
  minimum_rental_days: number;
  maximum_rental_days: number;
  included_km_per_day: number;
  extra_km_price: number;
  security_deposit: number;
  booking_advance_pct: number;
  cleaning_fee: number;
  delivery_fee: number;
  pickup_fee: number;
  late_fee_per_hour: number;
  fuel_policy: FuelPolicy;
  outstation_allowed: boolean;
  interstate_allowed: boolean;
  currency: string;
}

export interface BookingPriceQuote {
  durationDays: number;
  dailyRate: number;
  rentalAmount: number;
  includedKmTotal: number;
  extraKmRate: number;
  securityDeposit: number;
  platformFee: number;
  taxAmount: number;
  deliveryFee: number;
  discountAmount: number;
  totalPayableNow: number;
  ownerNetExpected: number;
  currency: string;
  policyVersion: string;
}

export interface Booking {
  id: string;
  booking_reference: string;
  vehicle_id: string;
  customer_id: string;
  owner_id: string;
  start_time: string;
  end_time: string;
  pickup_location_approx: string;
  pickup_instructions_exact?: string;
  status: BookingStatus;
  rejection_reason?: string;
  cancellation_reason?: string;
  payment_deadline?: string;
  created_at: string;
  updated_at: string;
  vehicle?: Vehicle;
  price_snapshot?: BookingPriceQuote;
}
