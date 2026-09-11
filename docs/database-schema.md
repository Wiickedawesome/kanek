# Database Schema

Supabase PostgreSQL 17. Project ref: `tlggdherqjvybpddsqjj`.

21 sequential migration files in `supabase/migrations/`. Never modify a deployed migration — create a new one.

TypeScript types are generated via:
```bash
supabase gen types typescript --project-id tlggdherqjvybpddsqjj > src/types/database.ts
```

---

## Enums

```sql
CREATE TYPE role AS ENUM ('rider', 'driver', 'admin');
CREATE TYPE account_status AS ENUM ('pending', 'active', 'restricted', 'suspended', 'pending_deletion', 'deleted');
CREATE TYPE post_type AS ENUM ('route_offer', 'route_request', 'errand', 'package', 'job');
CREATE TYPE post_status AS ENUM ('open', 'activated', 'in_progress', 'completed', 'cancelled', 'expired', 'filled');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled');
CREATE TYPE booking_role AS ENUM ('rider', 'driver');
CREATE TYPE payment_method AS ENUM ('cash', 'ekyash');
CREATE TYPE contract_status AS ENUM ('active', 'completed', 'cancelled');
CREATE TYPE strike_type AS ENUM ('soft', 'hard');
CREATE TYPE strike_reason AS ENUM ('late_cancel', 'no_show', 'early_leave', 'driver_no_show', 'report');
CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE driver_document_type AS ENUM ('license', 'insurance', 'id_card', 'vehicle_registration');
CREATE TYPE errand_category AS ENUM ('grocery', 'pharmacy', 'hardware', 'bills', 'pickup', 'other');
CREATE TYPE job_category AS ENUM ('construction', 'cleaning', 'gardening', 'delivery', 'handyman', 'landscaping', 'moving', 'tutoring', 'tech', 'other');
CREATE TYPE job_timeline AS ENUM ('asap', 'today', 'this_week', 'flexible');
CREATE TYPE pay_type AS ENUM ('hourly', 'fixed');
CREATE TYPE pickup_style AS ENUM ('single', 'multi_stop');
CREATE TYPE flag_reason AS ENUM ('spam', 'safety', 'inappropriate', 'fraud', 'other');
CREATE TYPE belize_district AS ENUM ('belize', 'cayo', 'corozal', 'orange_walk', 'stann_creek', 'toledo');
```

---

## Tables

### `profiles`
User profiles linked 1:1 with Supabase Auth (`auth.users`).

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | References `auth.users.id` ON DELETE CASCADE |
| `first_name` | `text` | First name |
| `last_name` | `text` | Last name |
| `email` | `text` | User email address |
| `phone` | `text` | Phone number (`+501XXXXXXX`) |
| `role` | `role` NOT NULL | Default `'rider'` |
| `account_status` | `account_status` | Default `'active'` |
| `rating_avg` | `numeric` | Average star rating (0.00–5.00) |
| `punctuality_pct` | `integer` | Punctuality percentage (0–100) |
| `strikes_soft` | `integer` | Count of soft strikes (late cancellation) |
| `strikes_hard` | `integer` | Count of hard strikes (no-show) |
| `district` | `belize_district` | User's primary district in Belize |
| `address_line` | `text` | Street / community address |
| `emergency_contact` | `text` | Emergency contact phone or email for SOS |
| `avatar_url` | `text` | URL to public profile picture in `avatars` bucket |
| `created_at` | `timestamptz` | Account creation timestamp |
| `last_active_at` | `timestamptz` | Last activity timestamp |
| `updated_at` | `timestamptz` | Last profile update timestamp |

**RLS**: Users can read public profile fields; users can update own profile; admins can update any profile.

---

### `driver_details`
Driver vehicle and license details submitted during onboarding.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | References `profiles.id` ON DELETE CASCADE |
| `vehicle_make` | `text` | Make of vehicle (e.g. Toyota) |
| `vehicle_model` | `text` | Model of vehicle (e.g. Corolla) |
| `vehicle_year` | `integer` | Vehicle manufacture year |
| `vehicle_color` | `text` | Vehicle color |
| `vehicle_plate` | `text` | License plate number |
| `verified` | `boolean` | Whether driver is fully verified |
| `review_status` | `review_status` | `'pending'`, `'approved'`, or `'rejected'` |
| `rejection_reason`| `text` | Reason if application was rejected |
| `license_url` | `text` | Driver's license document path |
| `insurance_url` | `text` | Vehicle insurance document path |
| `id_document_url` | `text` | Photo ID document path |
| `created_at` | `timestamptz` | Application timestamp |
| `updated_at` | `timestamptz` | Review timestamp |

---

### `driver_documents`
Per-document tracking for driver compliance.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Document UUID |
| `profile_id` | `uuid` NOT NULL | References `profiles.id` |
| `document_type` | `driver_document_type` | `'license'`, `'insurance'`, `'id_card'`, etc. |
| `document_url` | `text` NOT NULL | Storage path in `documents` bucket |
| `document_number` | `text` | License or policy number |
| `expiration_date` | `date` | Document expiration date |
| `review_status` | `review_status` | Status of review |
| `rejection_reason`| `text` | Rejection explanation |
| `created_at` | `timestamptz` | Upload timestamp |
| `updated_at` | `timestamptz` | Status update timestamp |

---

### `rider_documents`
Government ID verification documents for riders.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Document UUID |
| `user_id` | `uuid` NOT NULL | References `profiles.id` |
| `document_url` | `text` NOT NULL | Storage path in `documents` bucket |
| `verified` | `boolean` | Verification status |
| `review_status` | `review_status` | Review status |
| `rejection_reason`| `text` | Rejection explanation |
| `created_at` | `timestamptz` | Upload timestamp |
| `updated_at` | `timestamptz` | Review timestamp |

---

### `driver_checkins`
Selfie check-ins with GPS coordinates before trip commencement.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Checkin UUID |
| `contract_id` | `uuid` NOT NULL | References `contracts.id` |
| `driver_id` | `uuid` NOT NULL | References `profiles.id` |
| `selfie_url` | `text` NOT NULL | Storage path to verification photo |
| `lat` | `numeric` NOT NULL | Latitude at check-in |
| `lng` | `numeric` NOT NULL | Longitude at check-in |
| `created_at` | `timestamptz` | Timestamp |

---

### `posts`
All posts across all five mobility categories.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Post UUID |
| `author_id` | `uuid` NOT NULL | References `profiles.id` |
| `type` | `post_type` NOT NULL | `'route_offer'`, `'route_request'`, `'errand'`, `'package'`, `'job'` |
| `status` | `post_status` | Default `'open'` |
| `title` | `text` NOT NULL | Title of the post |
| `description` | `text` | Optional description |
| `origin_address` | `text` | Origin location name |
| `origin_lat` | `numeric` | Origin latitude (Belize bbox validated) |
| `origin_lng` | `numeric` | Origin longitude (Belize bbox validated) |
| `dest_address` | `text` | Destination location name |
| `dest_lat` | `numeric` | Destination latitude |
| `dest_lng` | `numeric` | Destination longitude |
| `departure_at` | `timestamptz` | Scheduled departure / start time |
| `price_cents` | `integer` | Price per seat or task in integer BZD cents |
| `seats_total` | `integer` | Total seats or slots offered (1–20) |
| `seats_remaining`| `integer` | Available seats remaining |
| `is_round_trip` | `boolean` | Round trip flag |
| `return_time` | `timestamptz` | Return schedule for round trips |
| `repeat_days` | `smallint[]` | Weekly recurring days (1=Mon .. 7=Sun) |
| `repeat_until` | `date` | End date for recurring schedule |
| `expires_at` | `timestamptz` | Auto-expiration timestamp (cleared by `expire-posts`) |
| `last_confirmed_at` | `timestamptz` | Last keepalive confirmation for recurring routes |
| `route_distance_km`| `numeric` | Computed route distance |
| `route_duration_min`| `numeric` | Estimated travel duration |
| `vehicle_description`| `text` | Vehicle summary |
| `pickup_notes` | `text` | Meeting or pickup instructions |
| `payment_method` | `payment_method` | Preferred payment method (`'cash'`, `'ekyash'`) |
| `pickup_style` | `pickup_style` | Single stop or multi-stop |
| `min_riders` | `integer` | Minimum riders required to activate route |
| `errand_category` | `errand_category` | Errand subcategory |
| `errand_fee_cents`| `integer` | Service fee for errand |
| `item_cost_cents` | `integer` | Estimated cost of items |
| `job_category` | `job_category` | Gig / job subcategory |
| `job_timeline` | `job_timeline` | Urgency timeline |
| `pay_rate_cents` | `integer` | Wage or rate in cents |
| `pay_type` | `pay_type` | Hourly or fixed payment |
| `created_at` | `timestamptz` | Post creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

---

### `bookings`
Requests and reservations on posts.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Booking UUID |
| `post_id` | `uuid` NOT NULL | References `posts.id` ON DELETE CASCADE |
| `user_id` | `uuid` NOT NULL | References `profiles.id` |
| `role` | `booking_role` | `'rider'` or `'driver'` |
| `status` | `booking_status` | `'pending'`, `'confirmed'`, `'cancelled'` |
| `seats_booked` | `integer` | Number of seats booked |
| `payment_method` | `payment_method` | Payment method |
| `cancel_reason` | `text` | Reason if cancelled |
| `cancelled_at` | `timestamptz` | Cancellation timestamp |
| `created_at` | `timestamptz` | Booking creation timestamp |
| `updated_at` | `timestamptz` | Last update timestamp |

---

### `contracts`
Agreements established between parties upon booking confirmation.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Contract UUID |
| `post_id` | `uuid` NOT NULL | References `posts.id` |
| `booking_id` | `uuid` NOT NULL | References `bookings.id` |
| `origin_address` | `text` | Trip origin |
| `dest_address` | `text` | Trip destination |
| `agreed_price_cents`| `integer` | Agreed payment in cents |
| `status` | `contract_status` | `'active'`, `'completed'`, `'cancelled'` |
| `departure_at` | `timestamptz` | Scheduled departure time |
| `completed_at` | `timestamptz` | Completion timestamp |
| `parties` | `jsonb` | Identity snapshot of driver and rider |
| `terms` | `jsonb` | Agreed contract terms |
| `created_at` | `timestamptz` | Contract agreement timestamp |

---

### `contract_events`
Chronological audit events tracking contract lifecycle.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Event UUID |
| `contract_id` | `uuid` NOT NULL | References `contracts.id` |
| `actor_id` | `uuid` NOT NULL | References `profiles.id` |
| `event_type` | `text` NOT NULL | Lifecycle event (e.g. `'trip_started'`, `'completed'`, `'cancelled'`) |
| `note` | `text` | Optional event note or detail |
| `created_at` | `timestamptz` | Event timestamp |

---

### `contract_messages`
Real-time encrypted chat messages between contract parties.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Message UUID |
| `contract_id` | `uuid` NOT NULL | References `contracts.id` |
| `sender_id` | `uuid` NOT NULL | References `profiles.id` |
| `body` | `text` NOT NULL | Message text |
| `created_at` | `timestamptz` | Message timestamp |

**Retention**: Messages are accessible for 24 hours following trip completion.

---

### `ratings`
Mutual reviews and punctuality ratings after contract completion.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Rating UUID |
| `contract_id` | `uuid` NOT NULL | References `contracts.id` |
| `rater_id` | `uuid` NOT NULL | References `profiles.id` (review author) |
| `rated_id` | `uuid` NOT NULL | References `profiles.id` (reviewed user) |
| `stars` | `smallint` NOT NULL | Rating score (1 to 5) |
| `was_on_time` | `boolean` | Punctuality vote |
| `comment` | `text` | Review text |
| `created_at` | `timestamptz` | Review timestamp |

**Trigger**: Triggers recalculation of `rating_avg` and `punctuality_pct` in `profiles`.

---

### `gas_prices`
Crowd-sourced fuel price reporting across Belize.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Record UUID |
| `reporter_id` | `uuid` NOT NULL | References `profiles.id` |
| `station_name` | `text` NOT NULL | Gas station brand and name |
| `station_lat` | `numeric` NOT NULL | Latitude |
| `station_lng` | `numeric` NOT NULL | Longitude |
| `regular_cents` | `integer` | Regular gasoline price per gallon in cents |
| `premium_cents` | `integer` | Premium gasoline price per gallon in cents |
| `diesel_cents` | `integer` | Diesel fuel price per gallon in cents |
| `verified_count`| `integer` | Number of community verifications |
| `reported_at` | `timestamptz` | Timestamp of latest price report |

---

### `flags`
Community moderation reports on posts or profiles.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Flag UUID |
| `reporter_id` | `uuid` NOT NULL | References `profiles.id` |
| `target_type` | `text` NOT NULL | `'post'`, `'user'`, `'booking'` |
| `target_id` | `uuid` NOT NULL | Target UUID |
| `reason` | `flag_reason` | Reason code |
| `description` | `text` | User explanation |
| `status` | `text` | `'pending'`, `'reviewed'`, `'action_taken'`, `'dismissed'` |
| `reviewed_by` | `uuid` | References `profiles.id` (admin reviewer) |
| `created_at` | `timestamptz` | Report timestamp |

---

### `strikes`
Disciplinary penalties applied to accounts.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Strike UUID |
| `user_id` | `uuid` NOT NULL | References `profiles.id` |
| `contract_id` | `uuid` | Related contract if applicable |
| `type` | `strike_type` NOT NULL | `'soft'` (late cancellation) or `'hard'` (no-show) |
| `reason` | `strike_reason` NOT NULL | Reason code |
| `auto_generated`| `boolean` | Whether applied automatically by cron |
| `created_at` | `timestamptz` | Penalty timestamp |

---

### `notifications`
In-app notification records sent to users.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Notification UUID |
| `user_id` | `uuid` NOT NULL | References `profiles.id` |
| `type` | `text` NOT NULL | Notification type code |
| `title` | `text` NOT NULL | Headline |
| `body` | `text` NOT NULL | Notification message |
| `read` | `boolean` | Read status |
| `data` | `jsonb` | Context payload (e.g. `postId`, `contractId`) |
| `created_at` | `timestamptz` | Timestamp |

---

### `notification_preferences`
Per-user notification delivery toggles.

| Column | Type | Description |
|---|---|---|
| `user_id` | `uuid` PK | References `profiles.id` |
| `push_enabled` | `boolean` | Enable push notifications |
| `email_enabled` | `boolean` | Enable email receipts and updates |
| `marketing_enabled`| `boolean`| Enable marketing communications |
| `created_at` | `timestamptz` | Timestamp |
| `updated_at` | `timestamptz` | Last change |

---

### `ekyash_transactions`
Digital payment records processed via E-Kyash Belize.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Transaction UUID |
| `contract_id` | `uuid` NOT NULL | References `contracts.id` |
| `payer_id` | `uuid` NOT NULL | References `profiles.id` |
| `payee_id` | `uuid` NOT NULL | References `profiles.id` |
| `order_id` | `text` NOT NULL | E-Kyash order identifier |
| `amount_cents` | `integer` NOT NULL | Transaction amount in cents |
| `platform_fee_cents`| `integer` | 3% platform fee |
| `donation_cents`| `integer` | Optional community donation |
| `currency` | `text` | Currency code (`'BZD'`) |
| `status` | `text` | `'pending'`, `'approved'`, `'cancelled'`, `'refunded'` |
| `created_at` | `timestamptz` | Transaction timestamp |

---

### `donation_totals`
Aggregate tracking for community mobility fund donations.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Record ID |
| `total_cents` | `bigint` NOT NULL | Cumulative donation total in cents |
| `updated_at` | `timestamptz` | Last accumulation timestamp |

---

### `email_receipts`
Audit log of transactional emails sent through Resend.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Receipt UUID |
| `user_id` | `uuid` NOT NULL | References `profiles.id` |
| `contract_id` | `uuid` | References `contracts.id` |
| `email_to` | `text` NOT NULL | Recipient email address |
| `type` | `text` NOT NULL | Receipt type |
| `status` | `text` | `'sent'`, `'failed'` |
| `error` | `text` | Error details if delivery failed |
| `sent_at` | `timestamptz` | Timestamp |

---

### `admin_actions`
Immutable audit trail of administrator decisions.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Action UUID |
| `admin_id` | `uuid` NOT NULL | References `profiles.id` (admin user) |
| `action` | `text` NOT NULL | Action name (e.g. `'approve_driver'`, `'issue_strike'`) |
| `target_type` | `text` NOT NULL | Target entity type (`'user'`, `'post'`, `'driver_document'`) |
| `target_id` | `uuid` NOT NULL | Target entity UUID |
| `reason` | `text` | Optional explanation |
| `created_at` | `timestamptz` | Timestamp of admin action |

---

## Migration Index (21 Sequential Migrations)

| # | File | Purpose |
|---|---|---|
| 00001 | `00001_initial_schema.sql` | Base tables, enums, RLS policies, trigger handlers |
| 00002 | `00002_admin_studio_migration.sql` | Admin database views and stored procedures |
| 00003 | `00003_fix_handle_new_user_trigger.sql` | Fix auth signup trigger for profile creation |
| 00004 | `00004_storage_bucket_policies.sql` | Storage policies for `avatars` and `documents` buckets |
| 00005 | `00005_set_initial_role_rpc.sql` | RPC for onboarding role assignment |
| 00006 | `00006_soft_delete_retention.sql` | Soft-delete retention window support |
| 00007 | `00007_reactivate_account_rpc.sql` | RPC to reactivate soft-deleted account |
| 00008 | `00008_rename_route_to_ride_text.sql` | UX text alignment migration |
| 00009 | `00009_route_repeat_days_return_time.sql` | Recurring route schedule columns |
| 00010 | `00010_messaging_24h_cutoff.sql` | Enforce 24-hour message cutoff after trip completion |
| 00011 | `00011_ekyash_partial_refund.sql` | E-Kyash partial refund tracking |
| 00012 | `00012_add_suspended_pending_deletion_status.sql` | Extended account lifecycle statuses |
| 00013 | `00013_fix_switch_to_driver_role.sql` | RPC fix for switching to driver role |
| 00014 | `00014_check_user_availability_rpc.sql` | Driver availability conflict check RPC |
| 00015 | `00015_scrub_invalid_coords.sql` | Geographic bounding box scrubber |
| 00016 | `00016_route_proceed_cancel_rpcs.sql` | Route proceeding and cancellation RPCs |
| 00017 | `00017_recurring_route_until_confirm.sql` | Recurring route keepalive and confirmation logic |
| 00018 | `00018_notification_preferences.sql` | User notification preferences table and defaults |
| 00019 | `00019_audit_remediation.sql` | Security audit remediation and RLS hardening |
| 00020 | `00020_fix_plpgsql_lint_errors.sql` | PL/pgSQL function syntax and variable shadowing fixes |
| 00021 | `00021_drop_road_reports_and_waitlist.sql` | Drop road_reports, votes, and waitlist tables |
