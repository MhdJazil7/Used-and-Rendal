# System Architecture & Technical Specifications
## Kerala Vehicle Rental & Used Marketplace (KVRM)

### 1. Architectural Philosophy & Principles
The platform is engineered as a **Kerala-first, server-authoritative, WhatsApp-friendly peer-to-peer and fleet vehicle rental marketplace** with an optional used-vehicle sales module.

Key architectural pillars:
1. **Strict Server Authority:** No client ever dictates prices, transaction amounts, state transitions, or authorization tiers. All pricing snapshots, hold windows, and deposit deductions are calculated and validated by the backend engine.
2. **Double-Booking Impossibility:** High-concurrency serialized row-level database locks (`SELECT ... FOR UPDATE`) coupled with an active 15-minute booking hold engine guarantee that two renters can never book or hold the same vehicle for overlapping dates.
3. **Data Minimization & Privacy by Design (DPDP Act 2023):** Raw Aadhaar numbers, PAN cards, and full driving licence images are **never** revealed to vehicle hosts or third parties. Hosts receive only cryptographically verified compliance badges.
4. **Authoritative State Machine:** 21 discrete states govern the entire rental lifecycle from draft request to deposit settlement or dispute resolution. Direct state mutations outside legal transitions are rejected at the database and application levels.
5. **Immutable Double-Entry Ledger:** All platform financial flows (rentals, commissions, GST, security deposits, damage deductions, refunds) are recorded in an append-only double-entry ledger (`ledger_entries`).
6. **WhatsApp as an Interactive Channel, Not System of Record:** WhatsApp Business Cloud API provides frictionless notifications and single-use signed action links. PostgreSQL remains the sole source of truth.

---

### 2. High-Level System Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT CLIENTS                                    |
|   +-----------------------+   +----------------------+   +--------------------+   |
|   |  Renter Web / Mobile  |   |  Host / Fleet Portal |   |  Admin Governance  |   |
|   +-----------+-----------+   +----------+-----------+   +---------+----------+   |
+---------------|--------------------------|-------------------------|--------------+
                |                          |                         |
                +--------------------------+-------------------------+
                                           | HTTPS / JSON
                                           v
+-----------------------------------------------------------------------------------+
|                        NEXT.JS 14 APP ROUTER (EDGE / NODE)                        |
|                                                                                   |
|  +--------------------+  +----------------------+  +---------------------------+  |
|  |   Security Layer   |  |   API Controllers    |  | Server Actions & UI SSR   |  |
|  | - HSTS, CSP, CORS  |  | - Auth (Phone OTP)   |  | - Dynamic Vehicle Search  |  |
|  | - Session HMAC     |  | - Booking Engine     |  | - Inspection UIs          |  |
|  | - Role Guard (RLS) |  | - Payment Webhooks   |  | - Financial Ledger UI     |  |
|  +---------+----------+  +-----------+----------+  +-------------+-------------+  |
|            |                         |                           |                |
+------------|-------------------------|---------------------------|----------------+
             |                         v                           |
+-----------------------------------------------------------------------------------+
|                               DOMAIN SERVICE LAYER                                |
|                                                                                   |
|  +-------------------+  +--------------------+  +-------------------------------+ |
|  |  Booking Engine   |  |   Payment Engine   |  |     Verification Engine       | |
|  | - 21-State FSM    |  | - Double-Entry     |  | - Driving Licence (LMV/MCWG)  | |
|  | - Row-Level Lock  |  | - Razorpay Adapter |  | - DPDP Redaction              | |
|  | - 15-Min Holds    |  | - Escrow/Holding   |  | - Auto-Expiry Pruning         | |
|  +-------------------+  +--------------------+  +-------------------------------+ |
|                                                                                   |
|  +-------------------+  +--------------------+  +-------------------------------+ |
|  | Inspection Engine |  | Dispute Governance |  |     WhatsApp Dispatcher       | |
|  | - Monotonic Odo   |  | - Deposit Locks    |  | - Cloud API Adapter           | |
|  | - Excess Km/Fuel  |  | - Evidence Store   |  | - Bilingual Templates (EN/ML) | |
|  | - 360 Photo Audit |  | - Staff Arbitrator |  | - Signed Action HMAC Links    | |
|  +-------------------+  +--------------------+  +-------------------------------+ |
+-----------------------------------------------------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                         POSTGRESQL RELATIONAL ENGINE                              |
|                                                                                   |
|  +-------------------+  +--------------------+  +-------------------------------+ |
|  |   Core Tables     |  | Financial Records  |  |     Audits & Governance       | |
|  | - profiles        |  | - payment_orders   |  | - audit_logs (append-only)    | |
|  | - user_roles      |  | - ledger_entries   |  | - booking_status_history      | |
|  | - vehicles        |  | - deposits         |  | - inspection_reports          | |
|  | - bookings        |  | - refunds          |  | - disputes                    | |
|  | - booking_holds   |  | - used_vehicles    |  | - legal_holds                 | |
|  +-------------------+  +--------------------+  +-------------------------------+ |
|                                                                                   |
|  Strict Row-Level Security (RLS) policies applied across all object boundaries    |
+-----------------------------------------------------------------------------------+
```

---

### 3. Core Database Schema & Entities

The relational model consists of 40+ production tables grouped into functional domains:

1. **Identity & Access Management:**
   - `profiles`: Primary account details with district localization and language preference (`en` / `ml`).
   - `user_roles`: Multi-role assignment (`CUSTOMER`, `OWNER`, `VERIFICATION_STAFF`, `DISPUTE_ARBITRATOR`, `ADMIN`, `SUPER_ADMIN`).
   - `verification_records`: KYC validation tracking without raw ID leakage.

2. **Vehicle Inventory & Rules:**
   - `vehicles`: Commercial and private rental units with masked registration plates (`KL-07-**-1234`).
   - `vehicle_pricing`: Base daily/weekly rates, included km allowance, extra km rate, fuel policy, security deposit amount.
   - `vehicle_rules`: Min driver age, driving experience years, outstation / interstate permissions, speed caps.
   - `vehicle_documents`: RC book, commercial permit, fitness certificate, insurance policy expiry tracking.

3. **Booking Lifecycle & Concurrency:**
   - `bookings`: Central record linking renter, host, vehicle, and date ranges.
   - `booking_price_snapshots`: Immutable frozen quote captured at the exact moment of booking request.
   - `booking_holds`: 15-minute exclusivity window created upon host acceptance.
   - `booking_status_history`: Complete append-only timeline of all status transitions with actor auditing.

4. **Condition Inspection & Claims:**
   - `inspections`: Pickup and return records with odometer readings, fuel percentage, cleanliness score.
   - `inspection_photos`: Pre-signed cloud storage links with 360-degree angles and timestamps.
   - `damage_claims`: Itemized damage assessments created during return inspection.

5. **Financial Ledger & Deposits:**
   - `payment_orders`: Gateway transaction order tracking.
   - `payment_transactions`: Completed customer payment captures.
   - `ledger_entries`: Double-entry accounting system with debit/credit balance invariance.
   - `deposits`: Security deposit holding, deductions, and refunds tracking.
   - `refunds`: Gateway refund tracking.

6. **Used Vehicle Marketplace (Optional Module):**
   - `used_vehicles`: Vehicle sales listings with inspection certificates and ownership records.
   - `used_vehicle_inquiries`: Renter/buyer inquiry threads.
   - *Controlled by feature flag `FEATURE_USED_SALES_ENABLED = false` by default.*

---

### 4. Concurrency & Double-Booking Protection

Double bookings are prevented via a three-phase atomic mechanism in `acceptBookingAndCreateHold`:

1. **Transaction Isolation & Row Locking:**
   ```sql
   SELECT id FROM vehicles WHERE id = $1 FOR UPDATE;
   ```
   Serializes concurrent acceptance requests on the vehicle row.
2. **Conflict Overlap Check:**
   ```sql
   SELECT id FROM bookings
   WHERE vehicle_id = $1 
     AND id != $2
     AND status IN ('CONFIRMED', 'PICKUP_PENDING', 'ACTIVE_RENTAL', 'RETURN_PENDING')
     AND (start_time < $4 AND end_time > $3);
   ```
3. **Active Booking Hold Verification:**
   ```sql
   SELECT id FROM booking_holds
   WHERE vehicle_id = $1 
     AND booking_id != $2
     AND is_released = FALSE
     AND expires_at > CURRENT_TIMESTAMP
     AND (hold_start < $4 AND hold_end > $3);
   ```
   If no conflict exists, an unreleased hold with `expires_at = CURRENT_TIMESTAMP + 15 minutes` is written, transitioning the booking to `PAYMENT_PENDING`.

---

### 5. Automated Data Retention & Legal Compliance

The platform implements an automated background retention worker (`RetentionEngine`):
- Customer identity documents and DL snapshots are assigned an expiry timestamp (`retention_until`).
- Before purging or anonymizing records, the engine verifies:
  1. No active legal holds exist on the user (`legal_holds`).
  2. No open disputes exist on any booking involving the user (`disputes.status IN ('OPEN', 'IN_PROGRESS', 'WAITING_PARTIES')`).
- If either condition is met, data purging is aborted and audited.
