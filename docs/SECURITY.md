# Security Architecture, Data Privacy & OWASP Mitigations
## Kerala Vehicle Rental & Used Marketplace (KVRM)

### 1. Compliance Stance & Legal Guardrails
1. **Never "100% Secure":** The platform never markets or represents itself as "100% secure" or "bulletproof", acknowledging real-world threat vectors.
2. **Never "Government Verified":** The platform does not claim government endorsement. Driving license checks are described accurately as *third-party document validity checks*.
3. **Data Protection & Privacy Act 2023 (DPDP Act):**
   - Raw Aadhaar numbers are never collected or stored.
   - Raw Driving License documents are retained only during the active verification and rental cycle, subject to automated expiry.
   - Hosts and vehicle owners are **strictly prohibited** from viewing raw customer identity or license images. Hosts receive only verified status badges and masked driver identifiers.

---

### 2. OWASP Top 10 Mitigations Matrix

| OWASP Risk | Platform Threat Scenario | Mitigation Strategy | Implementation Location |
| :--- | :--- | :--- | :--- |
| **A01: Broken Access Control** | Renter tries to accept a booking or inspect another user's booking | Object-level authorization checks & Row-Level Security (RLS) in PostgreSQL. | `src/lib/db/migrate.ts`, `src/app/api/bookings/` |
| **A02: Cryptographic Failures** | Session tokens or webhook signatures tampered with in transit | HMAC SHA-256 signatures with 32-byte secret keys; timing-safe comparisons (`crypto.timingSafeEqual`). | `src/lib/auth/session.ts`, `src/lib/payments/paymentService.ts` |
| **A03: Injection** | SQL injection via search filters or booking endpoints | 100% parameterized SQL queries via `$1, $2` placeholders. Zero raw string concatenation. | `src/lib/db/index.ts`, `src/app/api/vehicles/route.ts` |
| **A04: Insecure Design** | Double-booking race condition; client dictating booking price | Atomic row-level database locks (`FOR UPDATE`) with 15-minute hold windows; immutable server-side price snapshots. | `src/lib/booking/concurrency.ts`, `src/lib/pricing/calculator.ts` |
| **A05: Security Misconfiguration** | Clickjacking, MIME-sniffing, XSS in browser | Strict HTTP response headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Content Security Policy, HSTS). | `next.config.mjs` |
| **A06: Vulnerable Components** | Outdated or compromised node packages | Strict dependency management and clean audit scanning. | `package.json` |
| **A07: Identification & Auth Failures** | OTP brute-force attacks | In-memory and database rate-limiting: maximum 3 failed OTP attempts triggers 15-minute account lock. | `src/lib/auth/session.ts` |
| **A08: Software & Data Integrity** | Faked payment capture without gateway verification | HMAC signature verification of Razorpay orders before confirmation; double-entry ledger verification. | `src/lib/payments/paymentService.ts` |
| **A09: Logging & Monitoring Failures** | Untracked state changes or data deletion | Immutable append-only audit log (`audit_logs`) and status transition table (`booking_status_history`). | `src/lib/security/auditLogger.ts` |
| **A10: SSRF** | Attacker submitting malicious webhook or image URLs | Pre-defined domain allowlists for image assets and strict gateway webhook secret validation. | `src/lib/payments/paymentService.ts` |

---

### 3. Authentication & Session Architecture

1. **Phone OTP Workflow:**
   - User inputs valid Indian phone number (`+91` format).
   - Backend checks rate limiting: maximum 3 OTP requests per 10 minutes per phone number.
   - 6-digit cryptographically random OTP generated using `crypto.randomInt(100000, 999999)`.
   - OTP expires in 5 minutes.
   - If 3 incorrect attempts occur, phone number enters a 15-minute cooldown.
2. **Session Tokens:**
   - Standard JWT-style HMAC-signed tokens with expiration payload (`expiresAt: now + 24 hours`).
   - Stored in `httpOnly`, `SameSite=Lax`, `Secure` (in production) cookies (`kvr_session`) and supported via `Authorization: Bearer <token>` for API clients.
3. **Role-Based Access Control (RBAC):**
   - New registrations are restricted strictly to `CUSTOMER` role.
   - Privilege escalation to `OWNER`, `VERIFICATION_STAFF`, or `ADMIN` requires database administrator intervention or staff verification.

---

### 4. Sensitive Data Redaction & DPDP Compliance

1. **Vehicle Registration Numbers:**
   - Masked in all public views: `KL-07-**-1234`.
   - Full registration is visible to confirmed renters only 2 hours prior to rental start.
2. **Customer Identity Protection:**
   - Raw Aadhaar numbers and scans are never exposed to owners.
   - The owner inspection screen displays only:
     - Renter Name: `Rahul M.`
     - Verification Badge: `Verified Driver (LMV License Valid)`
     - Contact: Masked or in-app dialer.
3. **Audit Log Privacy (IP & PII Masking):**
   - Client IP addresses are hashed with daily rotating salt or subnet masked (`192.168.***.***`).
   - Sensitive fields in audit payloads (`token`, `password`, `otp`, `aadhaar`, `cardNumber`) are recursively stripped before disk commit.

---

### 5. Automated Data Retention & Legal Hold Engine

Under the DPDP Act 2023, data must not be stored longer than necessary for the stated business purpose:
- Driving license verification records have a retention period (`retention_until = CURRENT_TIMESTAMP + 180 days`).
- Background worker `RetentionEngine.runRetentionSweep()` runs daily:
  - Selects candidate records past `retention_until`.
  - **Check 1:** Verifies no active `legal_holds` exist for this user.
  - **Check 2:** Verifies no open or arbitrated `disputes` exist on any booking linked to this user.
  - If clear: purges document storage paths, redacts names and metadata, and logs an anonymization audit event.
  - If held: increments `skippedLegalHolds` or `skippedActiveDisputes` and preserves records intact for regulatory audit.
