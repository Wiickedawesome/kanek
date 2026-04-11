# Edge Functions

14 Deno edge functions in `supabase/functions/`. Deployed via `supabase functions deploy`.

Shared utilities live in `supabase/functions/_shared/`.

---

## E-Kyash Payment Functions

### ekyash-authorize

Authenticates with the E-Kyash API to get a session token.

- **Method:** POST
- **Input:** None (uses env secrets `EKYASH_SID`, `EKYASH_PIN_HASH`)
- **Output:** `{ session: string }`
- **Called by:** Mobile app before any E-Kyash operation

### ekyash-create-invoice

Creates a payment invoice for a contract.

- **Method:** POST
- **Input:**
  ```json
  {
    "contractId": "uuid",
    "payerId": "uuid",
    "payeeId": "uuid",
    "amountCents": 5000,
    "description": "Trip payment",
    "payerPhone": "+501XXXXXXX"
  }
  ```
- **Output:**
  ```json
  {
    "orderId": "string",
    "invoiceId": "string",
    "qrUrl": "string",
    "paymentLink": "string | null",
    "amountCents": 5000,
    "platformFeeCents": 150,
    "donationCents": 100
  }
  ```
- **Logic:** Calculates 3% platform fee + optional donation. Inserts `ekyash_transactions` row with status='pending'.

### ekyash-invoice-info

Queries the status of an existing invoice.

- **Method:** POST
- **Input:** `{ "orderId": "string", "invoiceId": "string" }`
- **Output:** Invoice details including `statusPay` (0=new, 2=declined, 3=approved)

### ekyash-callback (Webhook)

Receives payment status updates from E-Kyash.

- **Method:** POST
- **Input (from E-Kyash):**
  ```json
  {
    "orderId": "string",
    "invoiceId": "string",
    "transactionId": "string",
    "statusPay": 3,
    "hash": "hmac signature"
  }
  ```
- **Logic:** Validates HMAC signature. Updates `ekyash_transactions` status. Accumulates donation if approved.

### ekyash-cancel-invoice

Cancels a pending invoice.

- **Method:** POST
- **Input:** `{ "invoiceId": "string" }`
- **Output:** `{ success: boolean }`
- **DB Update:** Sets `ekyash_transactions.status = 'cancelled'`

### ekyash-refund

Issues a refund for an approved transaction.

- **Method:** POST
- **Input:**
  ```json
  {
    "transactionId": "string",
    "amount": 5000,
    "pinHash": "string",
    "refundReason": "User request"
  }
  ```
- **DB Update:** Sets `ekyash_transactions.status = 'refunded'`

---

## Communication Functions

### send-push

Sends a push notification to a user via the Expo Push API.

- **Method:** POST
- **Input:**
  ```json
  {
    "userId": "uuid",
    "title": "Booking Confirmed",
    "body": "Your ride to San Ignacio is confirmed",
    "data": { "contractId": "uuid" }
  }
  ```
- **Logic:** Fetches user's `push_token` from `push_tokens` table, sends to `https://exp.host/--/api/v2/push/send`.

### send-email-receipt

Sends a transaction receipt email via the Resend API.

- **Method:** POST
- **Input:**
  ```json
  {
    "userId": "uuid",
    "ekyashTxnId": "uuid",
    "contractId": "uuid",
    "type": "payment | refund | dispute"
  }
  ```
- **Logic:** Generates email from template, sends via Resend (`RESEND_API_KEY`). Inserts `email_receipts` row.

### send-sms-sos

Sends an SOS SMS with GPS location to the user's emergency contact.

- **Method:** POST
- **Input:**
  ```json
  {
    "userId": "uuid",
    "lat": 17.5,
    "lng": -88.5,
    "tripType": "route | errand | job"
  }
  ```
- **Logic:** Reads `emergency_contact` from profiles, sends SMS with Google Maps link.

---

## Scheduled Functions (Cron)

### expire-posts

Automatically expires old posts and road reports.

- **Trigger:** pg_cron (configured in migration 00032)
- **Logic:**
  - Posts with status `open`, `activated`, or `in_progress` where `expires_at <= now()` → set to `expired`
  - Road reports where `expires_at <= now()` → mark expired

### process-strikes

Processes strikes for no-shows, late cancellations, etc.

- **Trigger:** pg_cron or manual POST call
- **Input:**
  ```json
  {
    "userId": "uuid",
    "contractId": "uuid",
    "reason": "no_show | late_cancel | driver_no_show"
  }
  ```
- **Logic:**
  - Late cancel (< 1 hour before departure) → soft strike
  - No show → hard strike
  - Driver no show → hard strike
- **Auto-escalation:** 3 soft strikes → restricted. 2 hard strikes → suspended.

---

## Trigger Functions

### check-route-activation

Checks if a route post can be activated (enough bookings).

- **Method:** POST
- **Input:** `{ "postId": "uuid" }`
- **Output:** `{ "canActivate": boolean, "reason": "string", "seatsBooked": 5, "seatsTotal": 6 }`

### update-rating-avg

Database trigger that recalculates a user's rating after a new review.

- **Trigger:** After INSERT on `ratings` table
- **Updates:** `profiles.rating_avg` and `profiles.punctuality_pct`

### notify-user

Internal-only endpoint that creates a notification record and optionally sends a push notification via Expo Push API.

- **Method:** POST (service-role / internal only — rejects user-initiated requests)
- **Input:**
  ```json
  {
    "userId": "uuid",
    "type": "booking_confirmed | checkin_reminder | ...",
    "title": "string",
    "body": "string (optional)",
    "data": "object (optional)",
    "dedupe": "boolean (optional, default false)",
    "sendPush": "boolean (optional, default true)"
  }
  ```
- **Behavior:**
  - If `dedupe` is true, checks for an existing unread notification of the same type for the user and skips creation if found
  - Inserts a row into `notifications` table
  - If `sendPush` is true and the user has a push token, sends via Expo Push API
- **Output:** `{ "success": true, "notificationId": "uuid" }` or `{ "success": true, "skipped": true }` if deduplicated

---

## Environment Secrets

Set in Supabase dashboard → Edge Functions → Secrets:

| Secret | Purpose |
|--------|---------|
| `EKYASH_SID` | E-Kyash merchant SID |
| `EKYASH_PIN_HASH` | E-Kyash hashed PIN |
| `EKYASH_API_KEY` | E-Kyash API key |
| `RESEND_API_KEY` | Resend email API key |

---

## Deployment

```bash
# Deploy all functions
supabase functions deploy

# Deploy a single function
supabase functions deploy ekyash-create-invoice

# Test locally
supabase functions serve ekyash-create-invoice --env-file supabase/.env
```
