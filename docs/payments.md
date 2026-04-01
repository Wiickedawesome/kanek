# E-Kyash Payments

E-Kyash is a Belizean digital payment system. Kanek integrates it as a settlement method for posts that opt into digital payments, with a 3% platform fee.

---

## Payment Flow

```text
1. Post author selects a settlement method when creating the post
  └─→ Bookings inherit the post's `payment_method` (`cash` or `ekyash`)

2. Payer opens the active contract
  └─→ If the booking uses E-Kyash, the contract exposes the pay action

3. App creates invoice
  └─→ App calls `ekyash-create-invoice`
     ├─→ Calculates: amount + 3% platform fee
     ├─→ Leaves `donation_cents` at 0 until a donation opt-in is added
     ├─→ Creates `ekyash_transactions` row (status: pending)
     └─→ Returns QR URL + payment link

4. User pays
   └─→ User scans QR code or opens E-Kyash app via payment link

5. E-Kyash confirms
   └─→ E-Kyash calls ekyash-callback webhook
       ├─→ Validates HMAC signature
       ├─→ Updates ekyash_transactions status → approved/cancelled
       └─→ Accumulates donation in donation_totals

6. App confirms
   └─→ App polls ekyash-invoice-info → gets final status
```

---

## Platform Fee

- **Rate:** 3% of transaction amount
- **Example:** $50.00 BZD trip → $1.50 platform fee → $51.50 total charged to user
- Fee is calculated in `ekyash-create-invoice` edge function

---

## Optional Donation

The schema supports a community donation amount in `donation_totals`, but the current app flow does not expose a donation opt-in yet. New invoices therefore keep `donation_cents = 0`.

---

## Edge Functions

| Function                | Purpose                                      |
| ----------------------- | -------------------------------------------- |
| `ekyash-authorize`      | Get session token (uses EKYASH_SID + EKYASH_PIN_HASH) |
| `ekyash-create-invoice` | Create invoice, return QR URL                |
| `ekyash-invoice-info`   | Poll invoice/payment status                  |
| `ekyash-callback`       | Webhook — receive payment confirmation       |
| `ekyash-cancel-invoice` | Cancel pending invoice                       |
| `ekyash-refund`         | Refund approved transaction                  |

---

## TypeScript Types (`src/types/ekyash.ts`)

### Request/Response Types

```typescript
// Authorization
interface EkyashAuthRequest {
  sid: string;
  pinHash: string;
  pushkey: string;
}

interface EkyashAuthResponse {
  session: string;
  firstName: string | null;
  lastName: string | null;
  mobile: string | null;
}

// Invoice Creation
interface EkyashCreateInvoiceRequest {
  session: string;
  orderId: string;
  amount: number;          // cents
  currency: string;        // 'BZD'
  description: string;
  payer: string | null;    // phone
  longTerm: boolean;
  receipt: string | null;
  dateLife: string | null;
}

interface EkyashCreateInvoiceResponse {
  invoiceId: string;
  qrUrl: string;
  qrData: string;
  receiptUrl: string | null;
  paymentLink: string | null;
}

// Callback (Webhook)
interface EkyashCallbackPayload {
  orderId: string;
  invoiceId: string;
  transactionId: string;
  statusPay: 0 | 2 | 3;     // 0=new, 2=declined, 3=approved
  hash: string;              // HMAC signature
}

// App-level types
interface CreatePaymentResponse {
  orderId: string;
  invoiceId: string;
  qrUrl: string;
  paymentLink: string | null;
  amountCents: number;
  platformFeeCents: number;
  donationCents: number;
}

interface PaymentStatusResponse {
  status: 'pending' | 'approved' | 'cancelled' | 'refunded';
  transactionId: string | null;
}
```

---

## RTK Query Integration (`src/store/api/ekyashApi.ts`)

```typescript
// All mutations — no queries (payments are action-driven)
authorize()
createPayment(contractId, payerId, payeeId, amountCents, description, payerPhone)
checkPaymentStatus(orderId)
cancelPayment(invoiceId)
refundPayment(transactionId, amount, pinHash, reason)
```

---

## Database Tables

### ekyash_transactions

| Column                | Type                | Notes                                     |
| --------------------- | ------------------- | ----------------------------------------- |
| `order_id`            | `text UNIQUE`       | E-Kyash order ref                         |
| `invoice_id`          | `text UNIQUE`       | E-Kyash invoice ref                       |
| `transaction_id`      | `text UNIQUE`       | E-Kyash transaction ref                   |
| `amount_cents`        | `integer`           | Total amount                              |
| `platform_fee_cents`  | `integer`           | 3% fee                                    |
| `donation_cents`      | `integer DEFAULT 0` | Reserved for future donation opt-in       |
| `status`              | `ekyash_status`     | pending → approved / cancelled / refunded |

### donation_totals

Single-row table tracking cumulative community donations.

---

## Environment Secrets

Set in Supabase dashboard:

```text
EKYASH_SID=your-merchant-sid
EKYASH_PIN_HASH=your-hashed-pin
EKYASH_API_KEY=your-api-key
```

---

## UI Components (`src/components/payment/`)

| Component               | Purpose                                |
| ----------------------- | -------------------------------------- |
| `PaymentMethodSelector` | Cash vs E-Kyash choice (booking flow)  |
| `TransactionReceipt`    | Receipt display after payment          |

### Modal Screens

| Screen        | Route                 | Purpose                          |
| ------------- | --------------------- | -------------------------------- |
| E-Kyash Pay   | `/modals/ekyash-pay`  | Display QR code + payment link   |
