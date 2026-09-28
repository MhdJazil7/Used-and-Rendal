-- ============================================================
-- 003_seed_data.sql
-- Development / Staging Seed Data (Realistic Kerala Test Fixtures)
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
    ('usr-owner-3', '+919846066666', 'owner3@keralarentals.test', 'Geetha Krishnan', 'Geetha K. (Top Rated)', 'Thiruvananthapuram', 'Trivandrum', 'Pattom / Kowdiar', 'en'),
    ('usr-owner-4', '+919846077777', 'owner4@keralarentals.test', 'Vishnu Nambiar', 'Vishnu N. (Verified Host)', 'Kannur', 'Kannur', 'Payyambalam', 'ml'),
    ('usr-owner-5', '+919846088888', 'owner5@keralarentals.test', 'Shibu Varghese', 'Shibu V. (Highland Rentals)', 'Kottayam', 'Kottayam', 'Kanjikuzhy', 'en'),
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
    ('role-owner-3', 'usr-owner-3', 'OWNER'),
    ('role-owner-4', 'usr-owner-4', 'OWNER'),
    ('role-owner-5', 'usr-owner-5', 'OWNER'),
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
    ('vr-owner-2-id', 'usr-owner-2', 'IDENTITY', 'mock', 'REF_ID_2002', 'VERIFIED', CURRENT_TIMESTAMP, '{"identity_verified": true}'::jsonb),
    ('vr-owner-3-id', 'usr-owner-3', 'IDENTITY', 'mock', 'REF_ID_2003', 'VERIFIED', CURRENT_TIMESTAMP, '{"identity_verified": true}'::jsonb),
    ('vr-owner-4-id', 'usr-owner-4', 'IDENTITY', 'mock', 'REF_ID_2004', 'VERIFIED', CURRENT_TIMESTAMP, '{"identity_verified": true}'::jsonb),
    ('vr-owner-5-id', 'usr-owner-5', 'IDENTITY', 'mock', 'REF_ID_2005', 'VERIFIED', CURRENT_TIMESTAMP, '{"identity_verified": true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 25 DIVERSE VEHICLES ACROSS KERALA DISTRICTS
-- ============================================================
INSERT INTO vehicles (
    id, owner_id, slug, vehicle_type, make, model, variant, manufacturing_year, registration_year,
    fuel_type, transmission, seat_count, colour, odometer_km, vehicle_category, rental_mode,
    registration_state, registration_number_hash, registration_number_masked, registered_owner_name,
    owner_relationship, district, city, approximate_area, features, description, listing_status, eligibility_status
) VALUES 
-- 1. Maruti Swift AMT (Ernakulam)
(
    'veh-swift-1', 'usr-owner-1', 'maruti-swift-amt-kochi-1', 'HATCHBACK', 'Maruti Suzuki', 'Swift', 'ZXI AMT',
    2023, 2023, 'PETROL', 'AUTOMATIC', 5, 'Pearl Arctic White', 14200, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl07cz1234', 'KL-07-**-1234', 'Mathew Thomas', 'REGISTERED_OWNER',
    'Ernakulam', 'Kochi', 'Kaloor / Edappally',
    '["Air Conditioning", "Bluetooth Music", "Fastag Enabled", "Dual Airbags", "Reverse Camera", "ABS with EBD"]'::jsonb,
    'Well maintained 2023 Swift Automatic. Excellent mileage for Kerala city and highway driving. Sanitized after every trip.',
    'LIVE', 'ELIGIBLE'
),
-- 2. Mahindra Thar 4x4 (Ernakulam)
(
    'veh-thar-1', 'usr-owner-1', 'mahindra-thar-4x4-kochi-2', 'SUV', 'Mahindra', 'Thar', 'LX 4x4 Hard Top',
    2022, 2022, 'DIESEL', 'MANUAL', 4, 'Napoli Black', 28500, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl07bx9876', 'KL-07-**-9876', 'Mathew Thomas', 'REGISTERED_OWNER',
    'Ernakulam', 'Kochi', 'Palarivattom / Marine Drive',
    '["4x4 Drivetrain", "Convertible Hardtop", "Touchscreen Navigation", "Apple CarPlay", "Fastag", "All-Terrain Tyres"]'::jsonb,
    'Iconic 4x4 Thar for Kerala hill stations (Munnar, Wayanad, Vagamon). Strictly no extreme reckless off-roading.',
    'LIVE', 'ELIGIBLE'
),
-- 3. Toyota Innova Crysta (Kozhikode)
(
    'veh-innova-1', 'usr-owner-2', 'toyota-innova-crysta-calicut-3', 'MUV', 'Toyota', 'Innova Crysta', '2.4 ZX AT 7-Str',
    2023, 2023, 'DIESEL', 'AUTOMATIC', 7, 'Silver Metallic', 34000, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl11ay5555', 'KL-11-**-5555', 'Faisal Rahman', 'REGISTERED_OWNER',
    'Kozhikode', 'Calicut', 'Mananchira / Beach Road',
    '["Captain Seats 7-Seater", "Automatic Transmission", "Rear AC Vents", "Cruise Control", "Large Luggage Space", "Fastag"]'::jsonb,
    'Comfortable 7-seater Innova Crysta for family trips across Kerala. Regularly serviced at Toyota authorized center.',
    'LIVE', 'ELIGIBLE'
),
-- 4. Tata Nexon EV (Thiruvananthapuram)
(
    'veh-nexon-ev-1', 'usr-owner-3', 'tata-nexon-ev-trivandrum-4', 'SUV', 'Tata', 'Nexon EV', 'Max Empowered',
    2024, 2024, 'ELECTRIC', 'AUTOMATIC', 5, 'Intensi-Teal', 8100, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl01dg4321', 'KL-01-**-4321', 'Geetha Krishnan', 'REGISTERED_OWNER',
    'Thiruvananthapuram', 'Trivandrum', 'Kowdiar / Technopark',
    '["Fast Charging CCS2", "Electric Sunroof", "Ventilated Seats", "Harman Audio", "Green Number Plate", "Fastag"]'::jsonb,
    'Zero-emission luxury electric SUV. 350+ km real-world range. KSEB charging stations available across Kerala highway grid.',
    'LIVE', 'ELIGIBLE'
),
-- 5. Maruti Suzuki Baleno (Ernakulam)
(
    'veh-baleno-1', 'usr-owner-1', 'maruti-baleno-alpha-kochi-5', 'HATCHBACK', 'Maruti Suzuki', 'Baleno', 'Alpha AGS',
    2023, 2023, 'PETROL', 'AUTOMATIC', 5, 'Nexa Blue', 16800, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl07ca3321', 'KL-07-**-3321', 'Mathew Thomas', 'REGISTERED_OWNER',
    'Ernakulam', 'Aluva', 'Aluva Metro / Nedumbassery Road',
    '["Head-Up Display", "360 View Camera", "SmartPlay Pro+ 9-Inch", "Cruise Control", "Fastag"]'::jsonb,
    'Premium hatchback with 360 camera and HUD display. Ideal for airport pickups and city driving.',
    'LIVE', 'ELIGIBLE'
),
-- 6. Hyundai Creta (Thrissur)
(
    'veh-creta-1', 'usr-owner-1', 'hyundai-creta-turbo-thrissur-6', 'SUV', 'Hyundai', 'Creta', 'SX (O) Turbo DCT',
    2024, 2024, 'PETROL', 'AUTOMATIC', 5, 'Ranger Khaki', 11400, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl08bv7788', 'KL-08-**-7788', 'Mathew Thomas', 'REGISTERED_OWNER',
    'Thrissur', 'Thrissur', 'Round / Swaraj Round',
    '["Panoramic Sunroof", "Bose 8-Speaker Audio", "ADAS Safety Suite", "Dual Climate Control", "Fastag"]'::jsonb,
    'Top-spec Creta Turbo with panoramic glass sunroof. Perfect comfort for temple and cultural tours across Thrissur.',
    'LIVE', 'ELIGIBLE'
),
-- 7. Kia Seltos GTX+ (Ernakulam)
(
    'veh-seltos-1', 'usr-owner-1', 'kia-seltos-gtx-diesel-kochi-7', 'SUV', 'Kia', 'Seltos', 'GTX+ Diesel AT',
    2023, 2023, 'DIESEL', 'AUTOMATIC', 5, 'Imperial Blue', 21300, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl07ck9911', 'KL-07-**-9911', 'Mathew Thomas', 'REGISTERED_OWNER',
    'Ernakulam', 'Kochi', 'Kakkanad / Infopark',
    '["Bose Sound System", "Ventilated Front Seats", "Level 2 ADAS", "Air Purifier", "Fastag"]'::jsonb,
    'Sporty GTX+ Diesel Seltos. Extremely fuel efficient on highway runs to Munnar and Athirappilly.',
    'LIVE', 'ELIGIBLE'
),
-- 8. Honda City (Kottayam)
(
    'veh-city-1', 'usr-owner-5', 'honda-city-zx-cvt-kottayam-8', 'SEDAN', 'Honda', 'City', '5th Gen ZX CVT',
    2023, 2023, 'PETROL', 'AUTOMATIC', 5, 'Platinum White Pearl', 18900, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl05ae6633', 'KL-05-**-6633', 'Shibu Varghese', 'REGISTERED_OWNER',
    'Kottayam', 'Kottayam', 'Kumarakom / Kanjikuzhy',
    '["Honda Sensing ADAS", "LaneWatch Camera", "Leather Upholstery", "Electric Sunroof", "Fastag"]'::jsonb,
    'Executive sedan offering legendary rear-seat comfort. Perfect for Kumarakom backwater resort trips.',
    'LIVE', 'ELIGIBLE'
),
-- 9. Hyundai Verna (Kozhikode)
(
    'veh-verna-1', 'usr-owner-2', 'hyundai-verna-turbo-calicut-9', 'SEDAN', 'Hyundai', 'Verna', 'SX Turbo MT',
    2023, 2023, 'PETROL', 'MANUAL', 5, 'Abyss Black', 15200, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl11bu8822', 'KL-11-**-8822', 'Faisal Rahman', 'REGISTERED_OWNER',
    'Kozhikode', 'Calicut', 'Beypore / Beach Road',
    '["160 PS Turbo Engine", "Switchable Infotainment UI", "Heated Seats", "Rear AC Vents", "Fastag"]'::jsonb,
    'Fast and stylish 160 hp turbo sedan. Ideal for North Kerala coastal highway cruising.',
    'LIVE', 'ELIGIBLE'
),
-- 10. Maruti Suzuki Ertiga (Alappuzha)
(
    'veh-ertiga-1', 'usr-owner-5', 'maruti-ertiga-zxi-alappuzha-10', 'MUV', 'Maruti Suzuki', 'Ertiga', 'ZXI+ Smart Hybrid',
    2023, 2023, 'PETROL', 'MANUAL', 7, 'Magma Grey', 26400, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl04aw4411', 'KL-04-**-4411', 'Shibu Varghese', 'REGISTERED_OWNER',
    'Alappuzha', 'Alleppey', 'Boat Jetty / Beach Road',
    '["7 Seater", "Smart Hybrid Fuel Efficiency", "Roof-Mounted AC", "7-inch Touchscreen", "Fastag"]'::jsonb,
    'Budget-friendly 7-seater MUV with exceptional mileage. Great for family houseboat and coastal tours.',
    'LIVE', 'ELIGIBLE'
),
-- 11. Toyota Innova Hycross Hybrid (Ernakulam)
(
    'veh-hycross-1', 'usr-owner-1', 'toyota-hycross-zx-hybrid-kochi-11', 'MUV', 'Toyota', 'Innova Hycross', 'ZX (O) Strong Hybrid',
    2024, 2024, 'HYBRID', 'AUTOMATIC', 7, 'Blackish Ageha', 9800, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl07dm1010', 'KL-07-**-1010', 'Mathew Thomas', 'REGISTERED_OWNER',
    'Ernakulam', 'Kochi', 'Marine Drive / Willingdon Island',
    '["Ottoman Lounge Seats", "Strong Hybrid 23 km/l", "Panoramic Roof", "JBL 9-Speaker Audio", "Fastag"]'::jsonb,
    'The pinnacle of MPV luxury with ottoman captain recliner seats and silent self-charging hybrid drive.',
    'LIVE', 'ELIGIBLE'
),
-- 12. Tata Punch i-CNG (Palakkad)
(
    'veh-punch-1', 'usr-owner-2', 'tata-punch-cng-palakkad-12', 'HATCHBACK', 'Tata', 'Punch', 'Creative i-CNG',
    2023, 2023, 'CNG', 'MANUAL', 5, 'Tropical Mist', 17800, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl09ap5544', 'KL-09-**-5544', 'Faisal Rahman', 'REGISTERED_OWNER',
    'Palakkad', 'Palakkad', 'Fort Maidan / Stadium Road',
    '["Dual-Cylinder CNG Tech", "Usable Boot Space", "5-Star GNCAP Safety", "Auto Headlamps", "Fastag"]'::jsonb,
    'Ultra-economical compact SUV with twin-cylinder CNG. Low running cost for exploring Palakkad and Malampuzha.',
    'LIVE', 'ELIGIBLE'
),
-- 13. Maruti Suzuki Jimny 4x4 (Idukki)
(
    'veh-jimny-1', 'usr-owner-5', 'maruti-jimny-alpha-munnar-13', 'SUV', 'Maruti Suzuki', 'Jimny', 'Alpha 4x4 AT',
    2023, 2023, 'PETROL', 'AUTOMATIC', 4, 'Kinetic Yellow', 13200, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl06au7722', 'KL-06-**-7722', 'Shibu Varghese', 'REGISTERED_OWNER',
    'Idukki', 'Munnar', 'Munnar Town / Old Munnar',
    '["AllGrip Pro 4WD", "Ladder Frame Chassis", "Hill Descent Control", "High Ground Clearance", "Fastag"]'::jsonb,
    'Compact mountain goat 4x4 built for narrow tea plantation roads, fog, and steep ghats in Munnar.',
    'LIVE', 'ELIGIBLE'
),
-- 14. Mahindra Scorpio-N (Wayanad)
(
    'veh-scorpio-n-1', 'usr-owner-2', 'mahindra-scorpio-n-4x4-wayanad-14', 'SUV', 'Mahindra', 'Scorpio-N', 'Z8L 4WD AT 7-Str',
    2024, 2024, 'DIESEL', 'AUTOMATIC', 7, 'Deep Forest Green', 14500, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl12az8899', 'KL-12-**-8899', 'Faisal Rahman', 'REGISTERED_OWNER',
    'Wayanad', 'Kalpetta', 'Kalpetta / Vythiri Pass',
    '["4XPLOR Terrain Modes", "Sony 12-Speaker 3D Audio", "Sunroof", "7 Seats", "Fastag"]'::jsonb,
    'Rugged body-on-frame 4WD powerhouse tailored for the Thamarassery Churam ghats and Wayanad forest routes.',
    'LIVE', 'ELIGIBLE'
),
-- 15. Mahindra XUV700 AWD (Kannur)
(
    'veh-xuv700-1', 'usr-owner-4', 'mahindra-xuv700-ax7l-kannur-15', 'SUV', 'Mahindra', 'XUV700', 'AX7L AWD Diesel AT',
    2023, 2023, 'DIESEL', 'AUTOMATIC', 7, 'Midnight Black', 24100, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl13at2244', 'KL-13-**-2244', 'Vishnu Nambiar', 'REGISTERED_OWNER',
    'Kannur', 'Kannur', 'Payyambalam Beach Road',
    '["All-Wheel Drive", "Panoramic Skyroof", "Smart Door Handles", "AdrenoX AI", "Fastag"]'::jsonb,
    'Luxury AWD flagship 7-seater SUV with high-speed stability and advanced driver assistance.',
    'LIVE', 'ELIGIBLE'
),
-- 16. Hyundai i20 (Malappuram)
(
    'veh-i20-1', 'usr-owner-2', 'hyundai-i20-asta-malappuram-16', 'HATCHBACK', 'Hyundai', 'i20', 'Asta (O) 1.2 MT',
    2023, 2023, 'PETROL', 'MANUAL', 5, 'Fiery Red', 19400, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl10bc6677', 'KL-10-**-6677', 'Faisal Rahman', 'REGISTERED_OWNER',
    'Malappuram', 'Manjeri', 'Manjeri / Calicut Road',
    '["Bose Premium Audio", "Sunroof", "Wireless Charging", "Air Purifier", "Fastag"]'::jsonb,
    'Premium hot hatch with punchy engine and Bose sound. Very popular for college and business travel.',
    'LIVE', 'ELIGIBLE'
),
-- 17. Tata Tiago EV (Kollam)
(
    'veh-tiago-ev-1', 'usr-owner-3', 'tata-tiago-ev-kollam-17', 'HATCHBACK', 'Tata', 'Tiago EV', 'XZ+ Tech LUX Long Range',
    2023, 2023, 'ELECTRIC', 'AUTOMATIC', 5, 'Teal Blue', 12300, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl02bg9933', 'KL-02-**-9933', 'Geetha Krishnan', 'REGISTERED_OWNER',
    'Kollam', 'Kollam', 'Ashtamudi / Beach Road',
    '["24 kWh Battery (250 km Range)", "Fast DC Charging", "Connected Car Tech", "Multi-Mode Regen", "Fastag"]'::jsonb,
    'The most affordable electric car rental in Kerala. Silent, automatic, and super light on the pocket.',
    'LIVE', 'ELIGIBLE'
),
-- 18. Skoda Slavia (Pathanamthitta)
(
    'veh-slavia-1', 'usr-owner-5', 'skoda-slavia-style-thiruvalla-18', 'SEDAN', 'Skoda', 'Slavia', '1.5 TSI Style DSG',
    2023, 2023, 'PETROL', 'AUTOMATIC', 5, 'Crystal Blue', 17600, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl03as1122', 'KL-03-**-1122', 'Shibu Varghese', 'REGISTERED_OWNER',
    'Pathanamthitta', 'Thiruvalla', 'Thiruvalla / MC Road',
    '["150 hp TSI Turbo", "7-Speed DSG", "Ventilated Seats", "Cooled Glovebox", "Fastag"]'::jsonb,
    'European driving dynamics and high ground clearance. Perfect for Sabarimala pilgrimage and NRI family visits.',
    'LIVE', 'ELIGIBLE'
),
-- 19. Maruti Suzuki Brezza (Kasaragod)
(
    'veh-brezza-1', 'usr-owner-4', 'maruti-brezza-zxi-kasaragod-19', 'SUV', 'Maruti Suzuki', 'Brezza', 'ZXI AT',
    2023, 2023, 'PETROL', 'AUTOMATIC', 5, 'Brave Khaki with White Roof', 22100, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl14au3355', 'KL-14-**-3355', 'Vishnu Nambiar', 'REGISTERED_OWNER',
    'Kasaragod', 'Kanhangad', 'Bekal Fort / Kanhangad',
    '["SmartPlay Pro 7-Inch", "Electric Sunroof", "Paddle Shifters", "Reliable K15C Engine", "Fastag"]'::jsonb,
    'Dependable compact SUV with smooth torque converter automatic. Best for visiting Bekal Fort and coastal Kasaragod.',
    'LIVE', 'ELIGIBLE'
),
-- 20. Kia Carens (Thrissur)
(
    'veh-carens-1', 'usr-owner-1', 'kia-carens-diesel-guruvayur-20', 'MUV', 'Kia', 'Carens', 'Prestige Plus 1.5 CRDi 7-Str',
    2023, 2023, 'DIESEL', 'MANUAL', 7, 'Gravity Grey', 29500, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl08by4488', 'KL-08-**-4488', 'Mathew Thomas', 'REGISTERED_OWNER',
    'Thrissur', 'Guruvayur', 'Guruvayur Temple Area',
    '["One-Touch Electric Tumble 2nd Row", "7 Seats", "Rear Window Sunshades", "6 Airbags Standard", "Fastag"]'::jsonb,
    'Spacious 7-seater diesel MUV ideal for temple pilgrimages and large family groups.',
    'LIVE', 'ELIGIBLE'
),
-- 21. Maruti Suzuki WagonR (Ernakulam)
(
    'veh-wagonr-1', 'usr-owner-1', 'maruti-wagonr-zxi-kochi-21', 'HATCHBACK', 'Maruti Suzuki', 'WagonR', '1.2 ZXI MT',
    2023, 2023, 'PETROL', 'MANUAL', 5, 'Silky Silver', 21000, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl07cf8855', 'KL-07-**-8855', 'Mathew Thomas', 'REGISTERED_OWNER',
    'Ernakulam', 'Tripunithura', 'Statue Junction / Hill Palace',
    '["Tall Boy Stance", "Huge Boot Space", "High Seating Visibility", "Excellent City Mileage", "Fastag"]'::jsonb,
    'The tall-boy city favorite. Easy to park, easy to drive, and extremely spacious inside.',
    'LIVE', 'ELIGIBLE'
),
-- 22. Royal Enfield Classic 350 (Idukki)
(
    'veh-classic-350-1', 'usr-owner-5', 're-classic-350-vagamon-22', 'TWO_WHEELER', 'Royal Enfield', 'Classic 350', 'Halcyon Black Dual Channel ABS',
    2023, 2023, 'PETROL', 'MANUAL', 2, 'Halcyon Black', 11200, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl06av1100', 'KL-06-**-1100', 'Shibu Varghese', 'REGISTERED_OWNER',
    'Idukki', 'Vagamon', 'Pine Forest / Vagamon Meadows',
    '["Dual Channel ABS", "J-Series Engine (Smooth Thump)", "Touring Mirrors", "Crash Guard", "Phone Mount"]'::jsonb,
    'Legendary modern Classic with the refined J-series thump. Experience the misty curves of Vagamon on two wheels.',
    'LIVE', 'ELIGIBLE'
),
-- 23. Royal Enfield Himalayan 450 (Wayanad)
(
    'veh-himalayan-1', 'usr-owner-2', 're-himalayan-450-wayanad-23', 'TWO_WHEELER', 'Royal Enfield', 'Himalayan 450', 'Kamet White',
    2024, 2024, 'PETROL', 'MANUAL', 2, 'Kamet White', 6700, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl12ba5522', 'KL-12-**-5522', 'Faisal Rahman', 'REGISTERED_OWNER',
    'Wayanad', 'Sultan Bathery', 'Bathery / Edakkal Caves',
    '["Sherpa 450 Liquid-Cooled Engine", "TFT Google Maps Navigation", "Switchable ABS", "Long Travel Suspension"]'::jsonb,
    'The ultimate all-roads adventure motorcycle. Long-travel suspension glides effortlessly over rough estate trails.',
    'LIVE', 'ELIGIBLE'
),
-- 24. Yamaha Aerox 155 (Ernakulam)
(
    'veh-aerox-1', 'usr-owner-1', 'yamaha-aerox-155-fort-kochi-24', 'TWO_WHEELER', 'Yamaha', 'Aerox 155', 'Monster Energy MotoGP Edition',
    2023, 2023, 'PETROL', 'AUTOMATIC', 2, 'Monster Energy Black', 9400, 'COMMERCIAL_RENTAL', 'SELF_DRIVE',
    'KL', 'hash_kl07cj7744', 'KL-07-**-7744', 'Mathew Thomas', 'REGISTERED_OWNER',
    'Ernakulam', 'Fort Kochi', 'Princess Street / Vasco da Gama Square',
    '["R15 VVA 155cc Engine", "Front ABS", "24.5L Underseat Storage", "Traction Control", "Helmet Provided"]'::jsonb,
    'Sporty maxi-scooter with R15 derived engine. The fastest and most stylish way to explore the heritage alleys of Fort Kochi.',
    'LIVE', 'ELIGIBLE'
),
-- 25. Force Urbania Luxury (Ernakulam)
(
    'veh-traveller-1', 'usr-owner-1', 'force-urbania-luxury-nedumbassery-25', 'VAN', 'Force Motors', 'Urbania', 'Medium Wheelbase 12-Str AC',
    2024, 2024, 'DIESEL', 'MANUAL', 12, 'Arctic Silver', 19800, 'COMMERCIAL_TOURIST', 'WITH_DRIVER',
    'KL', 'hash_kl07dn9900', 'KL-07-**-9900', 'Mathew Thomas', 'AUTHORIZED_REPRESENTATIVE',
    'Ernakulam', 'Kochi', 'Cochin International Airport (COK) / Nedumbassery',
    '["12 Reclining Executive Seats", "Individual AC Vents & USB Ports", "Air Suspension Comfort", "Huge Luggage Bay", "Chauffeur Included"]'::jsonb,
    'Next-gen luxury passenger van with business-class recliners. Dedicated commercial tourist vehicle for airport delegates & weddings.',
    'LIVE', 'ELIGIBLE'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- VEHICLE PRICING (25 VEHICLES)
-- ============================================================
INSERT INTO vehicle_pricing (
    vehicle_id, daily_price, weekly_price, minimum_rental_days, maximum_rental_days,
    included_km_per_day, extra_km_price, security_deposit, booking_advance_pct,
    cleaning_fee, late_fee_per_hour, fuel_policy, outstation_allowed, interstate_allowed
) VALUES 
('veh-swift-1', 1800.00, 11500.00, 1, 30, 200, 9.00, 3000.00, 100, 150.00, 150.00, 'SAME_LEVEL', TRUE, FALSE),
('veh-thar-1', 3500.00, 22000.00, 2, 14, 250, 14.00, 8000.00, 100, 300.00, 300.00, 'SAME_LEVEL', TRUE, FALSE),
('veh-innova-1', 3800.00, 24000.00, 1, 21, 250, 15.00, 7000.00, 100, 250.00, 350.00, 'FULL_TO_FULL', TRUE, TRUE),
('veh-nexon-ev-1', 2600.00, 16500.00, 1, 14, 200, 10.00, 5000.00, 100, 200.00, 200.00, 'SAME_LEVEL', TRUE, FALSE),
('veh-baleno-1', 1900.00, 12000.00, 1, 30, 200, 9.50, 3000.00, 100, 150.00, 150.00, 'SAME_LEVEL', TRUE, FALSE),
('veh-creta-1', 3200.00, 20000.00, 1, 21, 220, 12.00, 6000.00, 100, 250.00, 250.00, 'SAME_LEVEL', TRUE, TRUE),
('veh-seltos-1', 3300.00, 21000.00, 1, 21, 220, 13.00, 6000.00, 100, 250.00, 250.00, 'SAME_LEVEL', TRUE, TRUE),
('veh-city-1', 2700.00, 17000.00, 1, 21, 220, 11.00, 5000.00, 100, 200.00, 200.00, 'SAME_LEVEL', TRUE, TRUE),
('veh-verna-1', 2800.00, 17500.00, 1, 21, 220, 12.00, 5000.00, 100, 200.00, 200.00, 'SAME_LEVEL', TRUE, TRUE),
('veh-ertiga-1', 2400.00, 15000.00, 1, 30, 250, 11.00, 5000.00, 100, 200.00, 200.00, 'SAME_LEVEL', TRUE, FALSE),
('veh-hycross-1', 4500.00, 28500.00, 2, 21, 250, 16.00, 10000.00, 100, 300.00, 400.00, 'FULL_TO_FULL', TRUE, TRUE),
('veh-punch-1', 1600.00, 10000.00, 1, 30, 200, 8.50, 3000.00, 100, 150.00, 150.00, 'SAME_LEVEL', TRUE, FALSE),
('veh-jimny-1', 3200.00, 20000.00, 1, 14, 200, 12.00, 7000.00, 100, 250.00, 250.00, 'SAME_LEVEL', TRUE, FALSE),
('veh-scorpio-n-1', 3900.00, 25000.00, 2, 21, 250, 15.00, 9000.00, 100, 300.00, 350.00, 'SAME_LEVEL', TRUE, TRUE),
('veh-xuv700-1', 4200.00, 27000.00, 2, 21, 250, 16.00, 10000.00, 100, 300.00, 400.00, 'SAME_LEVEL', TRUE, TRUE),
('veh-i20-1', 1750.00, 11000.00, 1, 30, 200, 9.00, 3000.00, 100, 150.00, 150.00, 'SAME_LEVEL', TRUE, FALSE),
('veh-tiago-ev-1', 1600.00, 10000.00, 1, 21, 180, 8.00, 3000.00, 100, 150.00, 150.00, 'SAME_LEVEL', TRUE, FALSE),
('veh-slavia-1', 2900.00, 18500.00, 1, 21, 220, 12.00, 6000.00, 100, 200.00, 250.00, 'SAME_LEVEL', TRUE, TRUE),
('veh-brezza-1', 2200.00, 14000.00, 1, 30, 220, 10.00, 4000.00, 100, 200.00, 200.00, 'SAME_LEVEL', TRUE, FALSE),
('veh-carens-1', 2600.00, 16500.00, 1, 30, 250, 12.00, 5000.00, 100, 200.00, 250.00, 'SAME_LEVEL', TRUE, FALSE),
('veh-wagonr-1', 1300.00, 8000.00, 1, 30, 180, 7.50, 2500.00, 100, 150.00, 150.00, 'SAME_LEVEL', TRUE, FALSE),
('veh-classic-350-1', 1100.00, 7000.00, 1, 14, 150, 6.00, 2000.00, 100, 100.00, 100.00, 'SAME_LEVEL', TRUE, FALSE),
('veh-himalayan-1', 1500.00, 9500.00, 1, 14, 180, 7.50, 3000.00, 100, 100.00, 120.00, 'SAME_LEVEL', TRUE, FALSE),
('veh-aerox-1', 900.00, 5500.00, 1, 30, 120, 5.00, 1500.00, 100, 50.00, 80.00, 'SAME_LEVEL', TRUE, FALSE),
('veh-traveller-1', 5500.00, 35000.00, 1, 30, 300, 20.00, 12000.00, 100, 500.00, 500.00, 'FULL_TO_FULL', TRUE, TRUE)
ON CONFLICT (vehicle_id) DO NOTHING;

-- ============================================================
-- VEHICLE RULES (25 VEHICLES)
-- ============================================================
INSERT INTO vehicle_rules (vehicle_id, min_driver_age, min_driving_experience_years, speed_limit_kmh, custom_rules)
VALUES 
('veh-swift-1', 21, 1, 90, 'No smoking inside. Pets allowed in travel crates only.'),
('veh-thar-1', 23, 2, 90, 'Valid LMV license required. No sand dune racing or unauthorized river crossing.'),
('veh-innova-1', 22, 1, 100, 'Family use preferred. Interstate permits must be paid at state borders.'),
('veh-nexon-ev-1', 21, 1, 90, 'Charge up to 85-90% on fast DC chargers. Portable home charger provided in boot.'),
('veh-baleno-1', 21, 1, 90, 'City and airport runs preferred. Keep vehicle clean.'),
('veh-creta-1', 22, 1, 100, 'Sunroof must be closed when car is moving for safety.'),
('veh-seltos-1', 22, 1, 100, 'Diesel fuel only. Use Fastag lane at all toll booths.'),
('veh-city-1', 22, 1, 90, 'Caution on steep Kerala ramps due to long sedan wheelbase.'),
('veh-verna-1', 22, 1, 100, 'Premium 95 octane petrol recommended for optimum turbo performance.'),
('veh-ertiga-1', 21, 1, 90, 'Ideal for 7 passengers. Return with original floor mats.'),
('veh-hycross-1', 24, 2, 100, 'Luxury vehicle. Strictly no alcohol or smoking inside the vehicle.'),
('veh-punch-1', 20, 1, 80, 'Fill CNG at official HP/IOCL/Adani gas stations across Kerala.'),
('veh-jimny-1', 23, 2, 80, 'Engage 4H/4L only on off-road or slush terrain, never on dry tarmac.'),
('veh-scorpio-n-1', 23, 2, 90, 'Drive with care in Thamarassery ghat sections. Maintain low gear on descent.'),
('veh-xuv700-1', 23, 2, 100, 'AdrenoX app control enabled. Clean driving records required.'),
('veh-i20-1', 21, 1, 90, 'Music system must be kept at reasonable levels in residential areas.'),
('veh-tiago-ev-1', 20, 1, 80, 'Plan trips using KSEB / Tata Power app. Portable 15A socket cable included.'),
('veh-slavia-1', 22, 1, 100, 'European spec sedan. Excellent high-speed stability on MC Road.'),
('veh-brezza-1', 21, 1, 90, 'Economical automatic transmission. Child seat available on request.'),
('veh-carens-1', 21, 1, 90, 'Respect temple dress codes and park in designated paid areas.'),
('veh-wagonr-1', 20, 1, 80, 'Easy city driver. Maximum 5 passengers permitted per RC.'),
('veh-classic-350-1', 20, 1, 70, 'Helmet mandatory for rider and pillion (ISI certified helmet provided).'),
('veh-himalayan-1', 21, 1, 80, 'Riding gear mandatory. Valid two-wheeler motorcycle with gear (MCWG) license required.'),
('veh-aerox-1', 19, 1, 65, 'Automatic scooter. Valid two-wheeler license required. Beach riding strictly forbidden.'),
('veh-traveller-1', 25, 3, 80, 'Commercial tourist passenger permit vehicle. Chauffeur provided.')
ON CONFLICT (vehicle_id) DO NOTHING;
