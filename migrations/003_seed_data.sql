-- ============================================================
-- 003_seed_data.sql
-- Development / Testing Seed Data (Strictly Fake Test Accounts)
-- ============================================================

-- Seed System Settings
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES 
    ('platform_commission_pct', '10.0', 'Platform commission percentage on rentals'),
    ('payment_hold_window_minutes', '15', 'Minutes customer has to complete payment after owner accepts'),
    ('late_return_grace_period_minutes', '60', 'Grace period before hourly late fee applies'),
    ('min_advance_notice_hours', '2', 'Minimum advance notice required for booking start')
ON CONFLICT (setting_key) DO NOTHING;

-- Seed Feature Flags
INSERT INTO feature_flags (flag_key, is_enabled, description)
VALUES 
    ('RENTALS_ENABLED', TRUE, 'Primary vehicle rental operations active'),
    ('USED_SALES_ENABLED', FALSE, 'Used vehicle sales marketplace module (disabled by default)'),
    ('PAYMENTS_ENABLED', TRUE, 'Payment gateway integration active'),
    ('WHATSAPP_ENABLED', TRUE, 'WhatsApp Business Cloud API notifications active'),
    ('IDENTITY_VERIFICATION_ENABLED', TRUE, 'Automated KYC and driving license verification checks'),
    ('MALAYALAM_ENABLED', TRUE, 'Bilingual Malayalam locale support enabled'),
    ('INSTANT_BOOK_ENABLED', FALSE, 'Owner instant-booking feature (manual owner confirmation enforced)')
ON CONFLICT (flag_key) DO NOTHING;

-- Seed WhatsApp Templates
INSERT INTO whatsapp_message_templates (template_name, language, category, body_definition, status)
VALUES 
    ('booking_requested_owner', 'en', 'TRANSACTIONAL', 'Hello {{1}}, you have received a new rental request for {{2}} from {{3}} to {{4}}. Please review and respond in the app: {{5}}', 'APPROVED'),
    ('booking_requested_owner', 'ml', 'TRANSACTIONAL', 'നമസ്കാരം {{1}}, നിങ്ങളുടെ വാഹനം {{2}} വാടകയ്ക്കായി പുതിയ അപേക്ഷ ലഭിച്ചിരിക്കുന്നു. ദയവായി പരിശോധിക്കുക: {{5}}', 'APPROVED'),
    ('booking_accepted_customer', 'en', 'TRANSACTIONAL', 'Great news {{1}}! The owner has ACCEPTED your booking for {{2}}. Please complete your secure payment before {{3}} to confirm: {{4}}', 'APPROVED'),
    ('booking_accepted_customer', 'ml', 'TRANSACTIONAL', 'പ്രിയപ്പെട്ട {{1}}, നിങ്ങളുടെ ബുക്കിംഗ് ഉടമസ്ഥൻ അംഗീകരിച്ചു ({{2}}). സ്ഥിരീകരിക്കാൻ പണം നൽകുക: {{4}}', 'APPROVED'),
    ('booking_confirmed', 'en', 'TRANSACTIONAL', 'Booking Confirmed! Reference: {{1}}. Vehicle: {{2}}. Pickup location details: {{3}}', 'APPROVED'),
    ('pickup_inspection_ready', 'en', 'TRANSACTIONAL', 'Pickup inspection completed for {{1}}. Please verify odometer reading ({{2}} km) and fuel level ({{3}}%): {{4}}', 'APPROVED'),
    ('return_settlement_update', 'en', 'TRANSACTIONAL', 'Vehicle returned for booking {{1}}. Security deposit settlement status: {{2}}. Details: {{3}}', 'APPROVED')
ON CONFLICT (template_name) DO NOTHING;

-- Seed Test Users (Profiles)
INSERT INTO profiles (id, phone, email, full_name, display_name, address_district, address_city, address_approx_area, preferred_language)
VALUES 
    ('usr-cust-1', '+919846011111', 'customer1@keralarentals.test', 'Rahul Menon', 'Rahul M.', 'Ernakulam', 'Kochi', 'Edappally', 'en'),
    ('usr-cust-2', '+919846022222', 'customer2@keralarentals.test', 'Anjali Nair', 'Anjali N.', 'Thiruvananthapuram', 'Trivandrum', 'Kowdiar', 'ml'),
    ('usr-owner-1', '+919846033333', 'owner1@keralarentals.test', 'Mathew Thomas', 'Mathew T. (Verified Host)', 'Ernakulam', 'Kochi', 'Kaloor', 'en'),
    ('usr-owner-2', '+919846044444', 'owner2@keralarentals.test', 'Faisal Rahman', 'Faisal R. (Superhost)', 'Kozhikode', 'Calicut', 'Mananchira', 'ml'),
    ('usr-veri-1', '+919846055555', 'verification@keralarentals.test', 'Suresh Kumar', 'Verification Officer Suresh', 'Ernakulam', 'Kochi', 'Kakkanad', 'en'),
    ('usr-admin-1', '+919846099999', 'admin@keralarentals.test', 'Antigravity Platform Admin', 'Chief Operations Admin', 'Ernakulam', 'Kochi', 'Palarivattom', 'en')
ON CONFLICT (id) DO NOTHING;

-- Seed Roles
INSERT INTO user_roles (id, user_id, role)
VALUES 
    ('role-cust-1', 'usr-cust-1', 'CUSTOMER'),
    ('role-cust-2', 'usr-cust-2', 'CUSTOMER'),
    ('role-owner-1', 'usr-owner-1', 'OWNER'),
    ('role-owner-2', 'usr-owner-2', 'OWNER'),
    ('role-veri-1', 'usr-veri-1', 'VERIFICATION_STAFF'),
    ('role-admin-1', 'usr-admin-1', 'ADMIN'),
    ('role-super-1', 'usr-admin-1', 'SUPER_ADMIN')
ON CONFLICT (id) DO NOTHING;

-- Seed Verification Records for Users
INSERT INTO verification_records (id, user_id, verification_type, provider, provider_reference, status, verified_at, minimal_metadata)
VALUES 
    ('vr-cust-1-id', 'usr-cust-1', 'IDENTITY', 'mock', 'REF_ID_1001', 'VERIFIED', CURRENT_TIMESTAMP, '{"identity_verified": true, "name_matched": true}'::jsonb),
    ('vr-cust-1-dl', 'usr-cust-1', 'DRIVING_LICENCE', 'mock', 'REF_DL_1001', 'VERIFIED', CURRENT_TIMESTAMP, '{"dl_valid": true, "licence_type": "LMV", "expires": "2032-12-31"}'::jsonb),
    ('vr-cust-2-id', 'usr-cust-2', 'IDENTITY', 'mock', 'REF_ID_1002', 'VERIFIED', CURRENT_TIMESTAMP, '{"identity_verified": true, "name_matched": true}'::jsonb),
    ('vr-cust-2-dl', 'usr-cust-2', 'DRIVING_LICENCE', 'mock', 'REF_DL_1002', 'PENDING', NULL, '{"dl_submitted": true}'::jsonb),
    ('vr-owner-1-id', 'usr-owner-1', 'IDENTITY', 'mock', 'REF_ID_2001', 'VERIFIED', CURRENT_TIMESTAMP, '{"identity_verified": true}'::jsonb),
    ('vr-owner-2-id', 'usr-owner-2', 'IDENTITY', 'mock', 'REF_ID_2002', 'VERIFIED', CURRENT_TIMESTAMP, '{"identity_verified": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Seed Demo Vehicles
INSERT INTO vehicles (
    id, owner_id, slug, vehicle_type, make, model, variant, manufacturing_year, registration_year,
    fuel_type, transmission, seat_count, colour, odometer_km, vehicle_category, rental_mode,
    registration_state, registration_number_hash, registration_number_masked, registered_owner_name,
    owner_relationship, district, city, approximate_area, features, description, listing_status, eligibility_status
) VALUES 
(
    'veh-swift-1', 'usr-owner-1', 'maruti-swift-amt-kochi-1', 'HATCHBACK', 'Maruti Suzuki', 'Swift', 'ZXI AMT',
    2023, 2023, 'PETROL', 'AUTOMATIC', 5, 'Pearl Arctic White', 14200, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl07cz1234', 'KL-07-**-1234', 'Mathew Thomas', 'REGISTERED_OWNER',
    'Ernakulam', 'Kochi', 'Kaloor / Edappally',
    '["Air Conditioning", "Bluetooth Music", "Fastag Enabled", "Dual Airbags", "Reverse Camera", "ABS with EBD"]'::jsonb,
    'Well maintained 2023 Swift Automatic. Excellent mileage for Kerala city and highway driving. Sanatized after every trip.',
    'LIVE', 'ELIGIBLE'
),
(
    'veh-thar-1', 'usr-owner-1', 'mahindra-thar-4x4-kochi-2', 'SUV', 'Mahindra', 'Thar', 'LX 4x4 Hard Top',
    2022, 2022, 'DIESEL', 'MANUAL', 4, 'Napoli Black', 28500, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl07bx9876', 'KL-07-**-9876', 'Mathew Thomas', 'REGISTERED_OWNER',
    'Ernakulam', 'Kochi', 'Palarivattom / Marine Drive',
    '["4x4 Drivetrain", "Convertible Hardtop", "Touchscreen Navigation", "Apple CarPlay", "Fastag", "All-Terrain Tyres"]'::jsonb,
    'Iconic 4x4 Thar for Kerala hill stations (Munnar, Wayanad, Vagamon). Strictly no extreme reckless off-roading.',
    'LIVE', 'ELIGIBLE'
),
(
    'veh-innova-1', 'usr-owner-2', 'toyota-innova-crysta-calicut-3', 'MUV', 'Toyota', 'Innova Crysta', '2.4 ZX AT 7-Str',
    2023, 2023, 'DIESEL', 'AUTOMATIC', 7, 'Silver Metallic', 34000, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl11ay5555', 'KL-11-**-5555', 'Faisal Rahman', 'REGISTERED_OWNER',
    'Kozhikode', 'Calicut', 'Mananchira / Beach Road',
    '["Captain Seats 7-Seater", "Automatic Transmission", "Rear AC Vents", "Cruise Control", "Large Luggage Space", "Fastag"]'::jsonb,
    'Comfortable 7-seater Innova Crysta for family trips across Kerala. Regularly serviced at Toyota authorized center.',
    'LIVE', 'ELIGIBLE'
),
(
    'veh-nexon-ev-1', 'usr-owner-1', 'tata-nexon-ev-trivandrum-4', 'SUV', 'Tata', 'Nexon EV', 'Max Empowered',
    2024, 2024, 'ELECTRIC', 'AUTOMATIC', 5, 'Intensi-Teal', 8100, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl01dg4321', 'KL-01-**-4321', 'Mathew Thomas', 'REGISTERED_OWNER',
    'Thiruvananthapuram', 'Trivandrum', 'Kowdiar / Technopark',
    '["Fast Charging CCS2", "Electric Sunroof", "Ventilated Seats", "Harman Audio", "Green Number Plate", "Fastag"]'::jsonb,
    'Zero-emission luxury electric SUV. 350+ km real-world range. KSEB charging stations available across Kerala highway grid.',
    'LIVE', 'ELIGIBLE'
)
ON CONFLICT (id) DO NOTHING;

-- Seed Pricing for Vehicles
INSERT INTO vehicle_pricing (
    vehicle_id, daily_price, weekly_price, minimum_rental_days, maximum_rental_days,
    included_km_per_day, extra_km_price, security_deposit, booking_advance_pct,
    cleaning_fee, late_fee_per_hour, fuel_policy, outstation_allowed, interstate_allowed
) VALUES 
('veh-swift-1', 1800.00, 11500.00, 1, 30, 200, 9.00, 3000.00, 100, 150.00, 150.00, 'SAME_LEVEL', TRUE, FALSE),
('veh-thar-1', 3500.00, 22000.00, 2, 14, 250, 14.00, 8000.00, 100, 300.00, 300.00, 'SAME_LEVEL', TRUE, FALSE),
('veh-innova-1', 3800.00, 24000.00, 1, 21, 250, 15.00, 7000.00, 100, 250.00, 350.00, 'FULL_TO_FULL', TRUE, TRUE),
('veh-nexon-ev-1', 2600.00, 16500.00, 1, 14, 200, 10.00, 5000.00, 100, 200.00, 200.00, 'SAME_LEVEL', TRUE, FALSE)
ON CONFLICT (vehicle_id) DO NOTHING;

-- Seed Vehicle Rules
INSERT INTO vehicle_rules (vehicle_id, min_driver_age, min_driving_experience_years, speed_limit_kmh, custom_rules)
VALUES 
('veh-swift-1', 21, 1, 90, 'No smoking inside. Pets allowed in travel crates only.'),
('veh-thar-1', 23, 2, 90, 'Valid LMV license required. No sand dune racing or unauthorized river crossing.'),
('veh-innova-1', 22, 1, 100, 'Family use preferred. Interstate permits must be paid at state borders.'),
('veh-nexon-ev-1', 21, 1, 90, 'Charge up to 85-90% on fast DC chargers. Portable home charger provided in boot.')
ON CONFLICT (vehicle_id) DO NOTHING;
