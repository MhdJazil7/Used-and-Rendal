# Production Readiness, Launch Checklist & Kerala Statutory Compliance
## Kerala Vehicle Rental & Used Marketplace (KVRM)

### 1. Kerala Statutory & Motor Vehicles Compliance Checklist

| Statutory Area | Requirement | Platform Guardrail | Status |
| :--- | :--- | :--- | :--- |
| **Rent a Cab Scheme, 1989** | Commercial vehicles operating as self-drive rentals require appropriate commercial registration (black plate with yellow lettering in India). | Vehicle onboarding captures permit type (`COMMERCIAL_RENTAL` vs `PRIVATE_PEER`). Private peer-to-peer vehicles are clearly flagged with legal disclosure and limited rental modes. | ✅ Configured |
| **Kerala Police / Security Verification** | Identity and driving licence records must be auditable in case of traffic violations or law enforcement inquiries. | `verification_records` and `audit_logs` retain verification logs and masked DL metadata for 180 days with legal hold freeze capability. | ✅ Built & Verified |
| **Motor Vehicles Act, 1988** | Renter must hold valid Light Motor Vehicle (LMV) or Motorcycle (MCWG) driving licence with minimum experience. | Verification engine checks license validity and vehicle rules enforce `min_driver_age` and `min_driving_experience_years`. | ✅ Enforced |
| **GST Taxation (India)** | Platform commission is taxable at 18% GST (9% CGST + 9% SGST for intrastate Kerala). Vehicle rentals attract applicable GST. | `src/lib/pricing/calculator.ts` explicitly breaks down rental amount, platform fee (10%), and GST (18% on fee). | ✅ Formulated |
| **DPDP Act, 2023** | Customer KYC images must not be exposed to third parties without consent; automated data pruning when purpose is served. | Owners never receive raw Aadhaar/DL scans. Background retention worker (`RetentionEngine`) prunes expired documents. | ✅ Verified |

---

### 2. External Services Onboarding Checklist

1. **Meta WhatsApp Business API:**
   - [ ] Register WhatsApp Business Account (WABA) in Meta Business Manager.
   - [ ] Verify legal entity business name with Kerala Registrar of Companies / MSME Udyam.
   - [ ] Configure Webhook endpoint: `https://api.keralarentals.in/api/whatsapp/webhook`.
   - [ ] Submit bilingual message templates (`booking_requested_owner`, `booking_accepted_customer`, `booking_confirmed`) for Meta approval.
2. **Payment Gateway (Razorpay India):**
   - [ ] Complete Razorpay KYC with Business Bank Account and GSTIN.
   - [ ] Enable Route / Split Payments if host nodal payout is desired.
   - [ ] Configure Webhook secret and listen for `payment.captured`, `order.paid`, and `refund.processed`.
   - [ ] Switch `PAYMENT_PROVIDER_MODE=razorpay` in `.env.production`.
3. **Identity Verification & OCR Provider:**
   - [ ] Setup Surepass, Cashfree Verification, or Sandbox Digilocker API for DL & RC verification.
   - [ ] Configure `VERIFICATION_PROVIDER=surepass` and store API credentials in secure key manager.
4. **Cloud Object Storage (AWS S3 / Cloudflare R2):**
   - [ ] Create private bucket `kerala-rentals-inspections` with CORS restricted to marketplace domain.
   - [ ] Configure pre-signed PUT URLs with 15-minute expiration for mobile inspection uploads.

---

### 3. Day 1 Operational Runbooks

#### Runbook 1: Handling Host No-Show
1. Renter reports host failure to arrive at pickup location.
2. Support staff verifies status in Admin Portal (`/admin`).
3. If host confirms unavailability, admin clicks **Cancel by Host**:
   - Booking transitions to `OWNER_CANCELLED`.
   - Immediate 100% gateway refund issued to customer.
   - Host receives penalty strike on account.

#### Runbook 2: Renter Excess Mileage & Damage Settlement
1. Host conducts return inspection via mobile inspection UI (`/inspection/[id]`).
2. Takes 4 mandatory photos (odometer, fuel gauge, front, rear).
3. If excess mileage is detected:
   - System auto-calculates `excess_km * extra_km_rate`.
   - Host submits deduction request within held deposit.
   - Balance deposit is refunded immediately to customer's source account.

#### Runbook 3: Emergency Vehicle Suspension
1. Law enforcement or owner reports stolen vehicle or traffic violation.
2. Admin opens `/admin` -> Vehicle Operations.
3. Clicks **Suspend Vehicle**:
   - Status changes to `SUSPENDED`.
   - Vehicle instantly removed from `/rent` search catalog.
   - Any unconfirmed booking requests are cancelled.
