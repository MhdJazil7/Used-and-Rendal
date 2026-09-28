# Authoritative Booking State Machine & Lifecycle Graph
## Kerala Vehicle Rental & Used Marketplace (KVRM)

### 1. State Machine Philosophy
Every vehicle rental follows a strictly defined, server-authoritative finite state machine (FSM). 
Direct updates to the `status` column in `bookings` are forbidden outside the state transition coordinator (`src/lib/booking/stateMachine.ts`), and every state mutation creates an immutable audit row in `booking_status_history`.

---

### 2. The 21 Discrete Marketplace States

| State | Category | Description |
| :--- | :--- | :--- |
| `DRAFT` | Initiation | Renter exploring dates and calculating quotes. |
| `REQUESTED` | Negotiation | Customer submitted booking request; awaiting host review. |
| `OWNER_ACCEPTED` | Negotiation | Host accepted request; 15-minute booking hold created. |
| `PAYMENT_PENDING` | Payment | Renter given 15-minute payment window to pay online. |
| `PAYMENT_PROCESSING`| Payment | Payment gateway authorization in flight. |
| `PAYMENT_FAILED` | Payment | Gateway card/UPI failure; customer can retry before hold expiry. |
| `CONFIRMED` | Confirmed | Payment verified, deposit held, slot guaranteed. |
| `PICKUP_PENDING` | Handover | Within 2 hours of start time; pickup inspection ready. |
| `INSPECTION_PENDING`| Inspection | Digital inspection checklist awaiting party signatures. |
| `PICKED_UP` | Handover | Keys and vehicle handed over; odometer confirmed. |
| `ACTIVE_RENTAL` | In-Trip | Vehicle in renter custody. |
| `RETURN_PENDING` | Return | Renter en route to return location. |
| `RETURNED` | Return | Vehicle physically handed back to host. |
| `DEPOSIT_PENDING` | Settlement | Return inspection recorded; excess km/fuel calculated. |
| `DEPOSIT_REFUNDED`| Settlement | Clean return; 100% deposit refunded to renter. |
| `DEPOSIT_PARTIAL_REFUND` | Settlement | Deductions applied for fuel/excess km/damages; balance refunded. |
| `COMPLETED` | Terminal | Financials settled, trip closed. |
| `CUSTOMER_CANCELLED`| Terminal | Renter cancelled (refund per policy). |
| `OWNER_REJECTED` | Terminal | Host declined rental request. |
| `OWNER_CANCELLED` | Terminal | Host cancelled confirmed booking (host penalized). |
| `EXPIRED` | Terminal | 15-minute hold elapsed without payment. |
| `DISPUTED` | Governance | Formal dispute opened; security deposit locked. |
| `ADMIN_SUSPENDED`| Governance | Platform admin intervened due to violation or emergency. |

---

### 3. Legal Transition Matrix

```
DRAFT                  ---> [ REQUESTED, CUSTOMER_CANCELLED ]
REQUESTED              ---> [ OWNER_ACCEPTED, PAYMENT_PENDING, OWNER_REJECTED, CUSTOMER_CANCELLED, EXPIRED, ADMIN_SUSPENDED ]
OWNER_ACCEPTED         ---> [ PAYMENT_PENDING, CUSTOMER_CANCELLED, EXPIRED, ADMIN_SUSPENDED ]
PAYMENT_PENDING        ---> [ PAYMENT_PROCESSING, CONFIRMED, PAYMENT_FAILED, EXPIRED, CUSTOMER_CANCELLED, ADMIN_SUSPENDED ]
PAYMENT_PROCESSING     ---> [ CONFIRMED, PAYMENT_FAILED, ADMIN_SUSPENDED ]
PAYMENT_FAILED         ---> [ PAYMENT_PENDING, EXPIRED, CUSTOMER_CANCELLED, ADMIN_SUSPENDED ]
CONFIRMED              ---> [ PICKUP_PENDING, ACTIVE_RENTAL, CUSTOMER_CANCELLED, OWNER_CANCELLED, DISPUTED, ADMIN_SUSPENDED ]
PICKUP_PENDING         ---> [ ACTIVE_RENTAL, CUSTOMER_CANCELLED, OWNER_CANCELLED, DISPUTED, ADMIN_SUSPENDED ]
ACTIVE_RENTAL          ---> [ RETURN_PENDING, RETURNED, DISPUTED, ADMIN_SUSPENDED ]
RETURN_PENDING         ---> [ RETURNED, DISPUTED, ADMIN_SUSPENDED ]
RETURNED               ---> [ INSPECTION_PENDING, DEPOSIT_PENDING, DISPUTED, ADMIN_SUSPENDED ]
INSPECTION_PENDING     ---> [ DEPOSIT_PENDING, DISPUTED, ADMIN_SUSPENDED ]
DEPOSIT_PENDING        ---> [ DEPOSIT_REFUNDED, DEPOSIT_PARTIAL_REFUND, DISPUTED, COMPLETED, ADMIN_SUSPENDED ]
DEPOSIT_PARTIAL_REFUND ---> [ COMPLETED, DISPUTED, ADMIN_SUSPENDED ]
DEPOSIT_REFUNDED       ---> [ COMPLETED, ADMIN_SUSPENDED ]
DISPUTED               ---> [ DEPOSIT_PENDING, DEPOSIT_PARTIAL_REFUND, DEPOSIT_REFUNDED, COMPLETED, ADMIN_SUSPENDED ]
ADMIN_SUSPENDED        ---> [ REQUESTED, CONFIRMED, ACTIVE_RENTAL, CUSTOMER_CANCELLED, OWNER_CANCELLED, COMPLETED ]
```

*Note: `COMPLETED`, `CUSTOMER_CANCELLED`, `OWNER_REJECTED`, `OWNER_CANCELLED`, and `EXPIRED` are terminal states.*

---

### 4. Actor Authorization & Transition Guards

| Target Transition | Authorized Actors | Required Conditions |
| :--- | :--- | :--- |
| `REQUESTED` -> `PAYMENT_PENDING` | `OWNER` | Vehicle row locked, zero conflicting holds or bookings. |
| `PAYMENT_PENDING` -> `CONFIRMED` | `SYSTEM` / `CUSTOMER` | Payment gateway signature verified via HMAC SHA-256. |
| `CONFIRMED` -> `ACTIVE_RENTAL` | `OWNER` / `STAFF` | Digital pickup inspection submitted with odometer, fuel %, and photos. |
| `ACTIVE_RENTAL` -> `RETURNED` | `OWNER` / `STAFF` | Return inspection submitted with `return_odo >= pickup_odo`. |
| `RETURNED` -> `DEPOSIT_REFUNDED` | `OWNER` / `ADMIN` | `deductionAmount == 0` |
| `RETURNED` -> `DEPOSIT_PARTIAL_REFUND` | `OWNER` / `ADMIN` | `deductionAmount <= depositHeld` |
| Any -> `DISPUTED` | `CUSTOMER` / `OWNER` | Booking is active, confirmed, or in settlement; deposit is frozen. |
| Any -> `ADMIN_SUSPENDED` | `ADMIN` / `SUPER_ADMIN` | Staff security intervention. |
