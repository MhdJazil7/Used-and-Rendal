# WhatsApp Business API Architecture & Notification Design
## Kerala Vehicle Rental & Used Marketplace (KVRM)

### 1. Integration Strategy & Authority Boundary
- **PostgreSQL is the Sole System of Record:** WhatsApp is used exclusively as an interactive customer engagement, notification, and alert delivery channel.
- No transaction state mutation is ever accepted based solely on an incoming WhatsApp chat text.
- Interactive user actions (Accept Booking, Upload Inspection, Complete Payment) are dispatched via **Cryptographically Signed Action Links** that open secure, mobile-optimized web screens.

---

### 2. WhatsApp Notification Lifecycle & Flow

```
[System Event] (e.g. Booking Requested, Payment Due, Inspection Completed)
      |
      v
[NotificationService.sendNotification()]
      |
      +---> Check User Preferred Language ('ml' Malayalam or 'en' English)
      |
      +---> Lookup Approved WhatsApp Template (`whatsapp_message_templates`)
      |
      +---> Generate Single-Use HMAC Action Link (if action required)
      |
      +---> Log Message to `whatsapp_message_logs` (status: 'QUEUED')
      |
      v
[WhatsAppProvider] (Meta Cloud API / Mock Adapter)
      |
      +---> Dispatch via POST https://graph.facebook.com/v19.0/{PHONE_ID}/messages
      |
      v
[Webhook Listener] (Meta Callback -> /api/whatsapp/webhook)
      |
      +---> Update `whatsapp_message_logs` (DELIVERED, READ, FAILED)
```

---

### 3. Bilingual Template Specifications (EN & ML)

All templates are pre-approved under Meta WhatsApp Business Guidelines:

#### Template 1: Booking Requested (Host Alert)
- **Category:** `TRANSACTIONAL`
- **English (`en`):**
  > *"Hello {{1}}, you have received a new rental request for {{2}} from {{3}} to {{4}}. Please review and respond in the app: {{5}}"*
- **Malayalam (`ml`):**
  > *"നമസ്കാരം {{1}}, നിങ്ങളുടെ വാഹനം {{2}} വാടകയ്ക്കായി പുതിയ അപേക്ഷ ലഭിച്ചിരിക്കുന്നു (തീയതി: {{3}} മുതൽ {{4}} വരെ). ദയവായി പരിശോധിക്കുക: {{5}}"*

#### Template 2: Booking Accepted & Payment Required (Renter Alert)
- **Category:** `TRANSACTIONAL`
- **English (`en`):**
  > *"Great news {{1}}! The owner has ACCEPTED your booking for {{2}}. Please complete your secure payment before {{3}} to confirm: {{4}}"*
- **Malayalam (`ml`):**
  > *"പ്രിയപ്പെട്ട {{1}}, നിങ്ങളുടെ ബുക്കിംഗ് ഉടമസ്ഥൻ അംഗീകരിച്ചു ({{2}}). ബുക്കിംഗ് ഉറപ്പാക്കാൻ {{3}}-ന് മുൻപായി പണം നൽകുക: {{4}}"*

#### Template 3: Booking Confirmed (Both Parties)
- **Category:** `TRANSACTIONAL`
- **English (`en`):**
  > *"Booking Confirmed! Reference: {{1}}. Vehicle: {{2}}. Pickup location details: {{3}}"*
- **Malayalam (`ml`):**
  > *"ബുക്കിംഗ് സ്ഥിരീകരിച്ചു! റഫറൻസ്: {{1}}. വാഹനം: {{2}}. പിക്ക്-അപ്പ് സ്ഥലം: {{3}}"*

#### Template 4: Pickup Inspection & Checklist
- **Category:** `TRANSACTIONAL`
- **English (`en`):**
  > *"Pickup inspection completed for {{1}}. Please verify odometer reading ({{2}} km) and fuel level ({{3}}%): {{4}}"*

---

### 4. Signed Action Link Security

When an action is dispatched to WhatsApp, users receive a time-bound single-use link:

```
https://keralarentals.in/action/accept?bid=bk_123&exp=1727500000&sig=a8f5c...
```

1. **HMAC Signature:** Calculated as `HMAC-SHA256(bookingId + action + expiresAt, ACTION_LINK_SECRET)`.
2. **Expiration Enforcement:** Action links expire in 15 minutes to prevent stale execution.
3. **Single-Use Invalidation:** Once used, the corresponding booking status transitions, rendering the link invalid for any replay attempts.
4. **Zero Raw Token Exposure:** No admin or session JWT is passed in the URL.
