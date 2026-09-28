-- ============================================================
-- 002_rls_policies.sql
-- Row Level Security (RLS) Policies for Supabase / PostgreSQL
-- Strict Object-Level Data Segregation
-- ============================================================

-- Helper functions for role and user resolution in Supabase/PostgreSQL
CREATE OR REPLACE FUNCTION auth_uid() RETURNS TEXT AS $$
BEGIN
    RETURN current_setting('request.jwt.claim.sub', true);
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth_uid() 
        AND role IN ('ADMIN', 'SUPER_ADMIN')
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_verification_staff() RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth_uid() 
        AND role IN ('VERIFICATION_STAFF', 'ADMIN', 'SUPER_ADMIN')
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 1. PROFILES RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_self ON profiles
    FOR SELECT USING (id = auth_uid() OR is_admin());

CREATE POLICY profiles_update_self ON profiles
    FOR UPDATE USING (id = auth_uid())
    WITH CHECK (id = auth_uid());

-- 2. USER ROLES RLS (Strictly Server & Admin controlled)
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY roles_select_self ON user_roles
    FOR SELECT USING (user_id = auth_uid() OR is_admin());

CREATE POLICY roles_admin_all ON user_roles
    FOR ALL USING (is_admin());

-- 3. VEHICLES RLS
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Public can only see LIVE and ELIGIBLE vehicles
CREATE POLICY vehicles_select_public ON vehicles
    FOR SELECT USING (
        (listing_status = 'LIVE' AND eligibility_status = 'ELIGIBLE')
        OR owner_id = auth_uid()
        OR is_admin()
    );

CREATE POLICY vehicles_insert_owner ON vehicles
    FOR INSERT WITH CHECK (owner_id = auth_uid());

CREATE POLICY vehicles_update_owner ON vehicles
    FOR UPDATE USING (owner_id = auth_uid() OR is_admin())
    WITH CHECK (owner_id = auth_uid() OR is_admin());

-- 4. VEHICLE DOCUMENTS RLS (Strictly Owner and Verification Staff/Admin)
ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicle_docs_select ON vehicle_documents
    FOR SELECT USING (
        uploaded_by = auth_uid()
        OR EXISTS (SELECT 1 FROM vehicles v WHERE v.id = vehicle_id AND v.owner_id = auth_uid())
        OR is_verification_staff()
    );

CREATE POLICY vehicle_docs_insert ON vehicle_documents
    FOR INSERT WITH CHECK (
        uploaded_by = auth_uid()
        AND EXISTS (SELECT 1 FROM vehicles v WHERE v.id = vehicle_id AND v.owner_id = auth_uid())
    );

-- 5. VERIFICATION RECORDS & DOCUMENTS RLS (Customer Private Data)
-- OWNERS NEVER HAVE ACCESS TO CUSTOMER RAW VERIFICATION RECORDS OR DOCUMENTS!
ALTER TABLE verification_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY verification_records_select ON verification_records
    FOR SELECT USING (user_id = auth_uid() OR is_verification_staff());

ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY verification_documents_select ON verification_documents
    FOR SELECT USING (uploaded_by = auth_uid() OR is_verification_staff());

-- 6. BOOKINGS RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY bookings_select ON bookings
    FOR SELECT USING (
        customer_id = auth_uid()
        OR owner_id = auth_uid()
        OR is_admin()
    );

CREATE POLICY bookings_insert ON bookings
    FOR INSERT WITH CHECK (
        customer_id = auth_uid()
    );

CREATE POLICY bookings_update ON bookings
    FOR UPDATE USING (
        customer_id = auth_uid()
        OR owner_id = auth_uid()
        OR is_admin()
    );

-- 7. BOOKING PRICE & TERMS SNAPSHOTS RLS
ALTER TABLE booking_price_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY price_snapshots_select ON booking_price_snapshots
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM bookings b 
            WHERE b.id = booking_id 
            AND (b.customer_id = auth_uid() OR b.owner_id = auth_uid() OR is_admin())
        )
    );

-- 8. INSPECTIONS RLS
ALTER TABLE pickup_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY pickup_inspections_select ON pickup_inspections
    FOR SELECT USING (
        inspector_id = auth_uid() 
        OR customer_id = auth_uid() 
        OR is_admin()
    );

ALTER TABLE return_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY return_inspections_select ON return_inspections
    FOR SELECT USING (
        inspector_id = auth_uid() 
        OR customer_id = auth_uid() 
        OR is_admin()
    );

-- 9. DAMAGE CLAIMS & DISPUTES RLS
ALTER TABLE damage_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY damage_claims_select ON damage_claims
    FOR SELECT USING (
        owner_id = auth_uid() 
        OR customer_id = auth_uid() 
        OR is_admin()
    );

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY disputes_select ON disputes
    FOR SELECT USING (
        initiated_by = auth_uid()
        OR EXISTS (
            SELECT 1 FROM bookings b 
            WHERE b.id = booking_id 
            AND (b.customer_id = auth_uid() OR b.owner_id = auth_uid())
        )
        OR is_admin()
    );

-- 10. FINANCE, PAYMENTS & LEDGER RLS
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_select ON payment_orders
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.customer_id = auth_uid() OR is_admin()))
    );

CREATE POLICY deposits_select ON deposits
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_id AND (b.customer_id = auth_uid() OR b.owner_id = auth_uid() OR is_admin()))
    );

CREATE POLICY payouts_select ON payouts
    FOR SELECT USING (owner_id = auth_uid() OR is_admin());

CREATE POLICY ledger_admin_only ON ledger_entries
    FOR SELECT USING (is_admin());

-- 11. AUDIT LOGS & SECURITY INCIDENTS (ADMIN ONLY)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_admin_only ON audit_logs FOR ALL USING (is_admin());

ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY security_incidents_admin_only ON security_incidents FOR ALL USING (is_admin());
