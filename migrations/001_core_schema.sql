-- ============================================================
-- 001_core_schema.sql
-- Kerala-First Vehicle Rental Marketplace (+ Optional Used Vehicles)
-- Comprehensive PostgreSQL Schema with Strict Constraints
-- ============================================================

-- Schema uses text primary keys and built-in gen_random_uuid() where appropriate

-- ============================================================
-- 1. PROFILES & USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY, -- Maps to auth user ID (UUID string)
    phone TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    full_name TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    date_of_birth DATE,
    address_district TEXT NOT NULL DEFAULT 'Ernakulam',
    address_city TEXT,
    address_approx_area TEXT,
    address_full_encrypted TEXT, -- Never exposed publicly
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    preferred_language TEXT NOT NULL DEFAULT 'en', -- en, ml
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_roles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN (
        'CUSTOMER',
        'OWNER',
        'RENTAL_BUSINESS_OWNER',
        'SUPPORT_STAFF',
        'VERIFICATION_STAFF',
        'ADMIN',
        'SUPER_ADMIN'
    )),
    assigned_by TEXT REFERENCES profiles(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    whatsapp_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sms_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
    locale TEXT NOT NULL DEFAULT 'en-IN',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. PRIVACY & RETENTION
-- ============================================================

CREATE TABLE IF NOT EXISTS user_consents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL, -- 'terms_of_service', 'privacy_policy', 'rental_agreement', 'whatsapp_communication'
    policy_version TEXT NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    withdrawn_at TIMESTAMPTZ,
    ip_address_hash TEXT,
    user_agent_hash TEXT
);

CREATE TABLE IF NOT EXISTS legal_holds (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES profiles(id),
    booking_id TEXT,
    reason TEXT NOT NULL,
    placed_by TEXT NOT NULL REFERENCES profiles(id),
    placed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMPTZ,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS privacy_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(id),
    request_type TEXT NOT NULL CHECK (request_type IN ('ACCESS_EXPORT', 'CORRECTION', 'DELETION')),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED_LEGAL_HOLD')),
    reason TEXT,
    rejection_reason TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS retention_policies (
    id TEXT PRIMARY KEY,
    data_category TEXT NOT NULL UNIQUE, -- 'identity_documents', 'booking_telemetry', 'audit_logs', 'financial_records'
    retention_period_days INT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================================
-- 3. VEHICLES & ELIGIBILITY
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES profiles(id),
    slug TEXT NOT NULL UNIQUE,
    vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('CAR', 'SUV', 'MUV', 'HATCHBACK', 'SEDAN', 'TWO_WHEELER', 'VAN')),
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    variant TEXT,
    manufacturing_year INT NOT NULL,
    registration_year INT NOT NULL,
    fuel_type TEXT NOT NULL CHECK (fuel_type IN ('PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG')),
    transmission TEXT NOT NULL CHECK (transmission IN ('MANUAL', 'AUTOMATIC')),
    engine_capacity_cc INT,
    seat_count INT NOT NULL,
    door_count INT,
    colour TEXT NOT NULL,
    odometer_km INT NOT NULL DEFAULT 0,
    vehicle_category TEXT NOT NULL CHECK (vehicle_category IN ('COMMERCIAL_RENTAL', 'COMMERCIAL_TOURIST', 'PRIVATE_SELF_DRIVE')),
    rental_mode TEXT NOT NULL CHECK (rental_mode IN ('SELF_DRIVE', 'WITH_DRIVER')),
    registration_state TEXT NOT NULL DEFAULT 'KL',
    registration_number_hash TEXT NOT NULL, -- Hash for duplicate detection
    registration_number_masked TEXT NOT NULL, -- e.g. KL-07-**-1234
    registered_owner_name TEXT NOT NULL,
    owner_relationship TEXT NOT NULL CHECK (owner_relationship IN ('REGISTERED_OWNER', 'AUTHORIZED_REPRESENTATIVE', 'FLEET_MANAGER')),
    district TEXT NOT NULL, -- Kerala district e.g. 'Ernakulam'
    city TEXT NOT NULL,
    approximate_area TEXT NOT NULL,
    features JSONB NOT NULL DEFAULT '[]'::jsonb, -- ['Air Conditioning', 'Fastag', 'Bluetooth', 'GPS', 'Airbags']
    current_condition TEXT,
    description TEXT,
    listing_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (listing_status IN (
        'DRAFT', 'UNDER_REVIEW', 'LIVE', 'PAUSED', 'SUSPENDED', 'EXPIRED', 'ARCHIVED'
    )),
    eligibility_status TEXT NOT NULL DEFAULT 'PENDING_MANUAL_REVIEW' CHECK (eligibility_status IN (
        'ELIGIBLE', 'PENDING_MANUAL_REVIEW', 'REQUIRES_DOCUMENTS', 'INELIGIBLE', 'SUSPENDED'
    )),
    is_instant_book_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_photos (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    photo_type TEXT NOT NULL CHECK (photo_type IN (
        'FRONT', 'REAR', 'LEFT', 'RIGHT', 'INTERIOR', 'DASHBOARD', 'ODOMETER', 'OTHER'
    )),
    storage_path TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    uploaded_by TEXT NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_pricing (
    vehicle_id TEXT PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
    daily_price NUMERIC(10, 2) NOT NULL CHECK (daily_price > 0),
    weekly_price NUMERIC(10, 2),
    monthly_price NUMERIC(10, 2),
    minimum_rental_days INT NOT NULL DEFAULT 1 CHECK (minimum_rental_days >= 1),
    maximum_rental_days INT NOT NULL DEFAULT 30 CHECK (maximum_rental_days >= minimum_rental_days),
    included_km_per_day INT NOT NULL DEFAULT 150 CHECK (included_km_per_day >= 0),
    extra_km_price NUMERIC(6, 2) NOT NULL DEFAULT 10.00 CHECK (extra_km_price >= 0),
    security_deposit NUMERIC(10, 2) NOT NULL DEFAULT 5000.00 CHECK (security_deposit >= 0),
    booking_advance_pct INT NOT NULL DEFAULT 100 CHECK (booking_advance_pct BETWEEN 0 AND 100),
    cleaning_fee NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    delivery_fee NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    pickup_fee NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    late_fee_per_hour NUMERIC(8, 2) NOT NULL DEFAULT 200.00,
    fuel_policy TEXT NOT NULL DEFAULT 'SAME_LEVEL' CHECK (fuel_policy IN ('FULL_TO_FULL', 'SAME_LEVEL', 'CUSTOM')),
    outstation_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    interstate_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    additional_driver_fee NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'INR',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_rules (
    vehicle_id TEXT PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
    min_driver_age INT NOT NULL DEFAULT 21 CHECK (min_driver_age >= 18),
    min_driving_experience_years INT NOT NULL DEFAULT 1 CHECK (min_driving_experience_years >= 0),
    smoking_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    pets_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    speed_limit_kmh INT NOT NULL DEFAULT 90 CHECK (speed_limit_kmh > 0),
    custom_rules TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_documents (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN (
        'REGISTRATION_CERTIFICATE', 'INSURANCE', 'POLLUTION_UNDER_CONTROL', 'RENT_A_CAB_PERMIT', 'FITNESS_CERTIFICATE', 'TAX_RECEIPT'
    )),
    document_number_masked TEXT NOT NULL,
    storage_path TEXT NOT NULL, -- Stored in private bucket
    issue_date DATE,
    expiry_date DATE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED')),
    verification_notes TEXT,
    verified_by TEXT REFERENCES profiles(id),
    verified_at TIMESTAMPTZ,
    uploaded_by TEXT NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_availability (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'BLOCKED', 'MAINTENANCE', 'HOLD', 'BOOKED')),
    booking_id TEXT, -- nullable link if tied to booking/hold
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_availability_dates CHECK (end_time > start_time)
);

-- ============================================================
-- 4. VERIFICATION RECORDS (USER KYC & DRIVING ELIGIBILITY)
-- ============================================================

CREATE TABLE IF NOT EXISTS verification_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    verification_type TEXT NOT NULL CHECK (verification_type IN ('IDENTITY', 'DRIVING_LICENCE', 'OWNER_BUSINESS')),
    provider TEXT NOT NULL DEFAULT 'mock', -- 'signzy', 'digilocker', 'karza', 'mock'
    provider_reference TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED')),
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    retention_until TIMESTAMPTZ,
    legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    minimal_metadata JSONB NOT NULL DEFAULT '{}'::jsonb, -- E.g. {"name_matched": true, "dl_valid": true} (NO RAW AADHAAR)
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verification_documents (
    id TEXT PRIMARY KEY,
    verification_record_id TEXT NOT NULL REFERENCES verification_records(id) ON DELETE CASCADE,
    document_category TEXT NOT NULL CHECK (document_category IN ('AADHAAR_FRONT', 'AADHAAR_BACK', 'PASSPORT', 'DRIVING_LICENCE_FRONT', 'DRIVING_LICENCE_BACK')),
    storage_path TEXT NOT NULL, -- Strictly private bucket
    file_mime TEXT NOT NULL,
    file_size_bytes INT NOT NULL,
    uploaded_by TEXT NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS verification_events (
    id TEXT PRIMARY KEY,
    verification_record_id TEXT NOT NULL REFERENCES verification_records(id) ON DELETE CASCADE,
    actor_id TEXT REFERENCES profiles(id),
    action TEXT NOT NULL, -- 'INITIATED', 'DOCUMENTS_UPLOADED', 'MANUAL_APPROVED', 'MANUAL_REJECTED', 'EXPIRED'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 5. RENTALS & BOOKINGS (AUTHORITATIVE STATE MACHINE)
-- ============================================================

CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY, -- Internal UUID
    booking_reference TEXT NOT NULL UNIQUE, -- User-facing reference e.g. KVR-7H4P2M
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
    customer_id TEXT NOT NULL REFERENCES profiles(id),
    owner_id TEXT NOT NULL REFERENCES profiles(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    pickup_location_approx TEXT NOT NULL,
    pickup_instructions_exact TEXT, -- Provided only after confirmed payment
    status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN (
        'DRAFT',
        'REQUESTED',
        'OWNER_ACCEPTED',
        'OWNER_REJECTED',
        'PAYMENT_PENDING',
        'PAYMENT_FAILED',
        'CONFIRMED',
        'PICKUP_PENDING',
        'ACTIVE_RENTAL',
        'RETURN_PENDING',
        'RETURNED',
        'INSPECTION_PENDING',
        'DEPOSIT_PENDING',
        'DEPOSIT_PARTIAL_REFUND',
        'DEPOSIT_REFUNDED',
        'COMPLETED',
        'CUSTOMER_CANCELLED',
        'OWNER_CANCELLED',
        'EXPIRED',
        'DISPUTED',
        'ADMIN_SUSPENDED'
    )),
    rejection_reason TEXT,
    rejection_notes_internal TEXT,
    cancellation_reason TEXT,
    payment_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_booking_dates CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS booking_holds (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
    hold_start TIMESTAMPTZ NOT NULL,
    hold_end TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_released BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS booking_price_snapshots (
    booking_id TEXT PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
    rental_amount NUMERIC(10, 2) NOT NULL,
    duration_days INT NOT NULL,
    included_km_total INT NOT NULL,
    extra_km_rate NUMERIC(6, 2) NOT NULL,
    security_deposit NUMERIC(10, 2) NOT NULL,
    platform_fee NUMERIC(10, 2) NOT NULL,
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_payable_now NUMERIC(10, 2) NOT NULL,
    owner_net_expected NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    policy_version TEXT NOT NULL DEFAULT '1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS booking_terms_snapshots (
    booking_id TEXT PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
    terms_version TEXT NOT NULL,
    terms_content_hash TEXT NOT NULL,
    customer_accepted_at TIMESTAMPTZ NOT NULL,
    owner_accepted_at TIMESTAMPTZ,
    cancellation_policy_rules JSONB NOT NULL,
    fuel_policy TEXT NOT NULL,
    damage_policy_rules JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS booking_status_history (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    actor_id TEXT REFERENCES profiles(id),
    actor_role TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 6. INSPECTIONS & METRICS
-- ============================================================

CREATE TABLE IF NOT EXISTS pickup_inspections (
    booking_id TEXT PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
    inspector_id TEXT NOT NULL REFERENCES profiles(id),
    customer_id TEXT NOT NULL REFERENCES profiles(id),
    odometer_reading INT NOT NULL CHECK (odometer_reading >= 0),
    fuel_percentage INT NOT NULL CHECK (fuel_percentage BETWEEN 0 AND 100),
    ev_charge_percentage INT CHECK (ev_charge_percentage BETWEEN 0 AND 100),
    cleanliness_rating INT NOT NULL CHECK (cleanliness_rating BETWEEN 1 AND 5),
    existing_scratches_notes TEXT,
    accessories_verified JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. ['SPARE_TYRE', 'TOOLKIT', 'FASTAG', 'RC_COPY']
    inspection_photos JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of storage paths
    acknowledged_by_customer BOOLEAN NOT NULL DEFAULT FALSE,
    customer_acknowledged_at TIMESTAMPTZ,
    inspected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS return_inspections (
    booking_id TEXT PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
    inspector_id TEXT NOT NULL REFERENCES profiles(id),
    customer_id TEXT NOT NULL REFERENCES profiles(id),
    odometer_reading INT NOT NULL CHECK (odometer_reading >= 0),
    fuel_percentage INT NOT NULL CHECK (fuel_percentage BETWEEN 0 AND 100),
    ev_charge_percentage INT CHECK (ev_charge_percentage BETWEEN 0 AND 100),
    excess_km INT NOT NULL DEFAULT 0 CHECK (excess_km >= 0),
    excess_km_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (excess_km_charge >= 0),
    fuel_deficit_charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (fuel_deficit_charge >= 0),
    late_return_hours INT NOT NULL DEFAULT 0,
    late_return_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    new_damages_found BOOLEAN NOT NULL DEFAULT FALSE,
    damage_notes TEXT,
    inspection_photos JSONB NOT NULL DEFAULT '[]'::jsonb,
    acknowledged_by_customer BOOLEAN NOT NULL DEFAULT FALSE,
    customer_acknowledged_at TIMESTAMPTZ,
    inspected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 7. DAMAGE CLAIMS & DISPUTES
-- ============================================================

CREATE TABLE IF NOT EXISTS damage_claims (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
    owner_id TEXT NOT NULL REFERENCES profiles(id),
    customer_id TEXT NOT NULL REFERENCES profiles(id),
    category TEXT NOT NULL CHECK (category IN ('SCRATCH', 'DENT', 'INTERIOR_STAIN', 'MECHANICAL', 'TYRE', 'GLASS', 'MISSING_ITEM', 'OTHER')),
    description TEXT NOT NULL,
    claimed_amount NUMERIC(10, 2) NOT NULL CHECK (claimed_amount > 0),
    settled_amount NUMERIC(10, 2) CHECK (settled_amount >= 0),
    evidence_media JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of private storage paths
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN (
        'OPEN', 'CUSTOMER_NOTIFIED', 'CUSTOMER_ACCEPTED', 'CUSTOMER_DISPUTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'SETTLED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS disputes (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    initiated_by TEXT NOT NULL REFERENCES profiles(id),
    category TEXT NOT NULL CHECK (category IN (
        'DAMAGE', 'PAYMENT', 'DEPOSIT', 'REFUND', 'CANCELLATION', 'VEHICLE_CONDITION', 'VEHICLE_NOT_AS_DESCRIBED', 'PICKUP', 'RETURN', 'OTHER'
    )),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'WAITING_PARTIES', 'RESOLVED', 'CLOSED')),
    assigned_staff_id TEXT REFERENCES profiles(id),
    resolution_notes TEXT,
    deposit_action TEXT CHECK (deposit_action IN ('REFUND_FULL', 'PARTIAL_TO_OWNER', 'FULL_TO_OWNER', 'NO_ACTION')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS dispute_events (
    id TEXT PRIMARY KEY,
    dispute_id TEXT NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
    actor_id TEXT NOT NULL REFERENCES profiles(id),
    event_type TEXT NOT NULL, -- 'MESSAGE', 'EVIDENCE_SUBMITTED', 'STATUS_CHANGE', 'RESOLUTION_PROPOSED'
    message TEXT NOT NULL,
    is_internal_only BOOLEAN NOT NULL DEFAULT FALSE,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 8. FINANCE, PAYMENTS & DOUBLE-ENTRY LEDGER
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_orders (
    id TEXT PRIMARY KEY, -- Internal order ID
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    provider TEXT NOT NULL DEFAULT 'razorpay',
    provider_order_id TEXT NOT NULL UNIQUE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'ATTEMPTED', 'PAID', 'FAILED', 'EXPIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_transactions (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES payment_orders(id),
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    provider_payment_id TEXT NOT NULL UNIQUE,
    provider_signature TEXT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_method TEXT, -- 'card', 'upi', 'netbanking'
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'REFUNDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id TEXT PRIMARY KEY, -- Provider Event ID (e.g. event_991823) for deduplication
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed_status TEXT NOT NULL CHECK (processed_status IN ('SUCCESS', 'IGNORED', 'FAILED')),
    error_message TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deposits (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id),
    amount_held NUMERIC(10, 2) NOT NULL CHECK (amount_held >= 0),
    amount_refunded NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (amount_refunded >= 0),
    amount_deducted NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (amount_deducted >= 0),
    status TEXT NOT NULL DEFAULT 'HELD' CHECK (status IN ('HELD', 'SETTLING', 'PARTIALLY_REFUNDED', 'FULLY_REFUNDED', 'FORFEITED', 'DISPUTED')),
    settled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    provider_refund_id TEXT UNIQUE,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('DEPOSIT_REFUND', 'CANCELLATION_REFUND', 'OVERCHARGE_REFUND')),
    status TEXT NOT NULL CHECK (status IN ('INITIATED', 'PROCESSED', 'FAILED')),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payouts (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    owner_id TEXT NOT NULL REFERENCES profiles(id),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    provider_payout_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REVERSED')),
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY,
    booking_id TEXT REFERENCES bookings(id),
    entry_type TEXT NOT NULL CHECK (entry_type IN (
        'RENTAL_REVENUE', 'SECURITY_DEPOSIT_RECEIPT', 'PLATFORM_COMMISSION', 'TAX_PAYABLE',
        'DEPOSIT_REFUND', 'DAMAGE_DEDUCTION', 'OWNER_PAYOUT', 'OWNER_PAYOUT_REVERSAL', 'DISPUTE_ADJUSTMENT'
    )),
    direction TEXT NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    account_reference TEXT NOT NULL, -- 'CUSTOMER', 'OWNER', 'PLATFORM', 'DEPOSIT_ESCROW'
    provider_reference TEXT,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_reconciliation_items (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    app_amount NUMERIC(10, 2) NOT NULL,
    provider_amount NUMERIC(10, 2) NOT NULL,
    discrepancy_amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('MATCHED', 'MISMATCH_DETECTED', 'MANUALLY_RESOLVED')),
    notes TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 9. COMMUNICATION & NOTIFICATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('WHATSAPP', 'SMS', 'IN_APP', 'EMAIL')),
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_events (
    id TEXT PRIMARY KEY,
    provider_message_id TEXT UNIQUE,
    recipient_phone TEXT NOT NULL,
    template_name TEXT NOT NULL,
    language_code TEXT NOT NULL DEFAULT 'en',
    parameters JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_message_templates (
    template_name TEXT PRIMARY KEY,
    language TEXT NOT NULL, -- 'en', 'ml'
    category TEXT NOT NULL CHECK (category IN ('TRANSACTIONAL', 'ALERT', 'UPDATE')),
    body_definition TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10. REVIEWS & REPUTATION
-- ============================================================

CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id),
    author_id TEXT NOT NULL REFERENCES profiles(id),
    target_id TEXT NOT NULL REFERENCES profiles(id), -- User or Owner reviewed
    vehicle_id TEXT REFERENCES vehicles(id),
    author_role TEXT NOT NULL CHECK (author_role IN ('CUSTOMER', 'OWNER')),
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    vehicle_rating INT CHECK (vehicle_rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(booking_id, author_id)
);

CREATE TABLE IF NOT EXISTS review_reports (
    id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    reported_by TEXT NOT NULL REFERENCES profiles(id),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DISMISSED', 'CONTENT_REMOVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 11. SUPPORT TICKETS
-- ============================================================

CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(id),
    booking_id TEXT REFERENCES bookings(id),
    category TEXT NOT NULL CHECK (category IN (
        'BOOKING', 'PAYMENT', 'VERIFICATION', 'VEHICLE', 'PICKUP', 'RETURN', 'DEPOSIT', 'DAMAGE', 'REFUND', 'PRIVACY', 'ACCOUNT', 'TECHNICAL', 'OTHER'
    )),
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_OWNER', 'RESOLVED', 'CLOSED')),
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    assigned_staff_id TEXT REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_messages (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES profiles(id),
    message TEXT NOT NULL,
    is_staff_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_attachments (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    message_id TEXT REFERENCES support_messages(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_mime TEXT NOT NULL,
    uploaded_by TEXT NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 12. SECURITY, AUDIT & FRAUD DETECTION
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES profiles(id),
    actor_role TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    correlation_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb, -- Safe metadata, NEVER secrets/passwords/raw Aadhaar
    ip_address_masked TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_incidents (
    id TEXT PRIMARY KEY,
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    description TEXT NOT NULL,
    data_categories_affected JSONB NOT NULL DEFAULT '[]'::jsonb,
    systems_affected JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CONTAINED', 'INVESTIGATING', 'NOTIFIED', 'REMEDIATED', 'CLOSED')),
    reported_by TEXT NOT NULL REFERENCES profiles(id),
    containment_actions TEXT,
    remediation_notes TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS fraud_risk_flags (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES profiles(id),
    vehicle_id TEXT REFERENCES vehicles(id),
    flag_type TEXT NOT NULL CHECK (flag_type IN (
        'DOCUMENT_MISMATCH', 'DUPLICATE_VEHICLE', 'PAYMENT_ANOMALY', 'EXCESSIVE_CANCELLATIONS', 'MULTIPLE_ACCOUNT_SIGNAL', 'EXCESSIVE_DISPUTES', 'SUSPICIOUS_ACTIVITY'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH')),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISMISSED', 'CONFIRMED_FRAUD')),
    flagged_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 13. SYSTEM SETTINGS & FEATURE FLAGS
-- ============================================================

CREATE TABLE IF NOT EXISTS feature_flags (
    flag_key TEXT PRIMARY KEY,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value JSONB NOT NULL,
    description TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 14. OPTIONAL USED VEHICLE SALES
-- ============================================================

CREATE TABLE IF NOT EXISTS sale_listings (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL REFERENCES profiles(id),
    slug TEXT NOT NULL UNIQUE,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    variant TEXT,
    manufacturing_year INT NOT NULL,
    registration_year INT NOT NULL,
    odometer_km INT NOT NULL,
    fuel_type TEXT NOT NULL,
    transmission TEXT NOT NULL,
    ownership_count INT NOT NULL DEFAULT 1,
    insurance_valid_until DATE,
    puc_valid_until DATE,
    expected_price NUMERIC(12, 2) NOT NULL CHECK (expected_price > 0),
    district TEXT NOT NULL,
    city TEXT NOT NULL,
    approximate_area TEXT NOT NULL,
    service_history_summary TEXT,
    accident_declared BOOLEAN NOT NULL DEFAULT FALSE,
    modifications_declared BOOLEAN NOT NULL DEFAULT FALSE,
    hypothecation_active BOOLEAN NOT NULL DEFAULT FALSE,
    listing_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (listing_status IN ('DRAFT', 'UNDER_REVIEW', 'LIVE', 'SOLD', 'DELISTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_enquiries (
    id TEXT PRIMARY KEY,
    listing_id TEXT NOT NULL REFERENCES sale_listings(id) ON DELETE CASCADE,
    buyer_id TEXT NOT NULL REFERENCES profiles(id),
    message TEXT NOT NULL,
    inspection_requested BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REPLIED', 'INSPECTION_SCHEDULED', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INDEXES FOR HIGH-PERFORMANCE SEARCH & CONCURRENCY
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_vehicles_search ON vehicles(district, vehicle_type, listing_status, eligibility_status);
CREATE INDEX IF NOT EXISTS idx_vehicle_avail_lookup ON vehicle_availability(vehicle_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_bookings_lookup ON bookings(vehicle_id, start_time, end_time, status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_owner ON bookings(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_holds_active ON booking_holds(vehicle_id, expires_at) WHERE is_released = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_ledger_booking ON ledger_entries(booking_id);
