# Database Schema

Supabase PostgreSQL 17. Project ref: `tlggdherqjvybpddsqjj`.

50 sequential migration files in `supabase/migrations/`. Never modify a deployed migration — create a new one.

Types are generated via:
```bash
supabase gen types typescript --project-id tlggdherqjvybpddsqjj > src/types/database.ts
```

---

## Enums

```sql
CREATE TYPE role AS ENUM ('rider', 'driver', 'admin');
CREATE TYPE account_status AS ENUM ('pending', 'active', 'restricted', 'suspended', 'dormant');
CREATE TYPE post_type AS ENUM ('route_offer', 'route_request', 'errand', 'package', 'job');
CREATE TYPE post_status AS ENUM ('open', 'activated', 'in_progress', 'filled', 'completed', 'cancelled', 'expired');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'no_show', 'completed');
CREATE TYPE booking_role AS ENUM ('rider', 'driver');
CREATE TYPE payment_method AS ENUM ('cash', 'ekyash');
CREATE TYPE contract_status AS ENUM ('active', 'completed', 'disputed', 'cancelled');
CREATE TYPE strike_type AS ENUM ('soft', 'hard');
CREATE TYPE strike_reason AS ENUM ('late_cancel', 'no_show', 'early_leave', 'driver_no_show', 'report');
CREATE TYPE ekyash_status AS ENUM ('pending', 'approved', 'cancelled', 'refunded');
CREATE TYPE road_report_type AS ENUM ('accident', 'checkpoint', 'traffic', 'flooding', 'construction', 'road_damage');
CREATE TYPE errand_category AS ENUM ('grocery', 'bill', 'pharmacy', 'document', 'delivery', 'food', 'hardware', 'other');
CREATE TYPE pickup_style AS ENUM ('single', 'multi_stop');
CREATE TYPE flag_target AS ENUM ('post', 'user', 'booking');
CREATE TYPE flag_reason AS ENUM ('spam', 'scam', 'harassment', 'fake_account', 'safety', 'other');
CREATE TYPE flag_status AS ENUM ('pending', 'reviewed', 'action_taken', 'dismissed');
CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE admin_action_type AS ENUM ('approve_driver', 'reject_driver', 'approve_rider_doc', 'reject_rider_doc',
  'suspend_user', 'unsuspend_user', 'remove_post', 'dismiss_flag', 'issue_strike');
CREATE TYPE BelizeDistrict AS ENUM ('belize', 'cayo', 'corozal', 'orange_walk', 'stann_creek', 'toledo');
```

---

## Tables

### profiles

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | References `auth.users(id)` ON DELETE CASCADE |
| `phone` | `text` UNIQUE NOT NULL | Format: `+501XXXXXXX` |
| `full_name` | `text` | 1–50 chars |
| `role` | `role` NOT NULL DEFAULT 'rider' | rider, driver, admin |
| `account_status` | `account_status` DEFAULT 'pending' | |
| `avatar_url` | `text` | Storage bucket URL |
| `id_document_url` | `text` | Government ID photo |
| `id_verified` | `boolean` DEFAULT false | Admin verifies |
| `rating_avg` | `numeric(3,2)` DEFAULT 0 | 0.00–5.00, maintained by trigger |
| `rating_count` | `integer` DEFAULT 0 | |
| `punctuality_pct` | `integer` DEFAULT 100 | 0–100%, maintained by trigger |
| `soft_strikes` | `integer` DEFAULT 0 | Late cancels |
| `hard_strikes` | `integer` DEFAULT 0 | No-shows |
| `emergency_contact` | `text` | Phone number for SOS |
| `district` | `BelizeDistrict` | User's home district |
| `address` | `text` | User's address |
| `created_at` | `timestamptz` DEFAULT now() | |
| `updated_at` | `timestamptz` DEFAULT now() | |

**RLS:** Users can read all profiles, update own profile only. Admins can update any.

---

### posts

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `author_id` | `uuid` NOT NULL | FK → profiles(id) |
| `type` | `post_type` NOT NULL | route_offer, route_request, errand, package, job |
| `status` | `post_status` DEFAULT 'open' | |
| `title` | `text` NOT NULL | |
| `description` | `text` | Max 500 chars |
| `from_location` | `text` | Origin name |
| `from_lat` | `numeric(10,7)` | |
| `from_lng` | `numeric(10,7)` | |
| `to_location` | `text` | Destination name |
| `to_lat` | `numeric(10,7)` | |
| `to_lng` | `numeric(10,7)` | |
| `departure_date` | `date` | |
| `departure_time` | `time` | |
| `price_cents` | `integer` | In cents, max 999900 |
| `seats_total` | `integer` | 1–20 |
| `seats_available` | `integer` | Decremented on booking |
| `payment_method` | `payment_method` DEFAULT 'cash' | |
| `pickup_style` | `pickup_style` DEFAULT 'single' | |
| `errand_category` | `errand_category` | For errand posts |
| `item_cost_cents` | `integer` | Separate from errand fee |
| `expires_at` | `timestamptz` | Auto-expire via cron |
| `route_distance_km` | `numeric(10,2)` | Mapbox Directions result |
| `route_duration_min` | `numeric(10,2)` | Mapbox Directions result |
| `route_map_url` | `text` | Mapbox Static Map URL |
| `vehicle_make` | `text` | Driver's vehicle |
| `vehicle_color` | `text` | |
| `license_plate` | `text` | |
| `created_at` | `timestamptz` DEFAULT now() | |
| `updated_at` | `timestamptz` DEFAULT now() | |

**Job-specific columns** (added in migration 00011):
- `job_category`, `pay_type`, `pay_rate_cents`, `job_timeline`, `job_location`, `job_lat`, `job_lng`, `requirements`

**Indexes:** `idx_posts_author`, `idx_posts_type_status`, `idx_posts_location` (from_lat, from_lng)

**RLS:** Anyone can read open posts. Authors can create/update/delete own posts. Admins can update any.

---

### bookings

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `post_id` | `uuid` NOT NULL | FK → posts(id) ON DELETE CASCADE |
| `user_id` | `uuid` NOT NULL | FK → profiles(id) |
| `role` | `booking_role` NOT NULL | rider or driver |
| `status` | `booking_status` DEFAULT 'pending' | |
| `seats_booked` | `integer` DEFAULT 1 | |
| `payment_method` | `payment_method` DEFAULT 'cash' | |
| `created_at` | `timestamptz` DEFAULT now() | |
| `updated_at` | `timestamptz` DEFAULT now() | |

**Unique:** `idx_booking_unique (post_id, user_id)` — one booking per user per post.

**Trigger:** `on_booking_confirmed` — auto-creates contract, decrements seats_available.

**RLS:** Users can view own bookings. Post authors can view bookings on their posts.

---

### contracts

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `post_id` | `uuid` NOT NULL | FK → posts(id) |
| `booking_id` | `uuid` NOT NULL | FK → bookings(id) ON DELETE CASCADE |
| `driver_id` | `uuid` NOT NULL | FK → profiles(id) |
| `rider_id` | `uuid` NOT NULL | FK → profiles(id) |
| `status` | `contract_status` DEFAULT 'active' | |
| `payment_method` | `payment_method` DEFAULT 'cash' | |
| `amount_cents` | `integer` | Agreed price |
| `completed_at` | `timestamptz` | |
| `created_at` | `timestamptz` DEFAULT now() | |

**RLS:** Only contract parties (driver_id or rider_id) can view/update.

---

### ratings

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `contract_id` | `uuid` NOT NULL | FK → contracts(id) ON DELETE CASCADE |
| `rater_id` | `uuid` NOT NULL | FK → profiles(id) |
| `rated_id` | `uuid` NOT NULL | FK → profiles(id) |
| `stars` | `integer` NOT NULL | 1–5, CHECK constraint |
| `was_on_time` | `boolean` | Punctuality tracking |
| `comment` | `text` | Max 500 chars |
| `created_at` | `timestamptz` DEFAULT now() | |

**Unique:** `idx_rating_unique (contract_id, rater_id)` — one rating per rater per contract.

**Trigger:** `update_rating_avg` — recalculates `profiles.rating_avg` and `punctuality_pct`.

---

### strikes

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` NOT NULL | FK → profiles(id) |
| `contract_id` | `uuid` | FK → contracts(id) |
| `type` | `strike_type` NOT NULL | soft or hard |
| `reason` | `strike_reason` NOT NULL | |
| `notes` | `text` | Admin notes |
| `created_at` | `timestamptz` DEFAULT now() | |

**Auto-escalation:**
- 3 soft strikes → account_status = 'restricted'
- 2 hard strikes → account_status = 'suspended'

---

### road_reports

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `reporter_id` | `uuid` NOT NULL | FK → profiles(id) |
| `type` | `road_report_type` NOT NULL | accident, checkpoint, traffic, flooding, construction, road_damage |
| `description` | `text` | Max 500 chars |
| `lat` | `numeric(10,7)` NOT NULL | |
| `lng` | `numeric(10,7)` NOT NULL | |
| `upvote_count` | `integer` DEFAULT 1 | Community confirmation |
| `gone_count` | `integer` DEFAULT 0 | "It's gone" counter |
| `expires_at` | `timestamptz` | Auto-expire via cron |
| `created_at` | `timestamptz` DEFAULT now() | |

---

### gas_prices

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `reporter_id` | `uuid` NOT NULL | FK → profiles(id) |
| `station_name` | `text` NOT NULL | |
| `station_lat` | `numeric(10,7)` NOT NULL | |
| `station_lng` | `numeric(10,7)` NOT NULL | |
| `regular_cents` | `integer` | Price per imperial gallon |
| `premium_cents` | `integer` | |
| `diesel_cents` | `integer` | |
| `created_at` | `timestamptz` DEFAULT now() | |

---

### ekyash_transactions

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `contract_id` | `uuid` NOT NULL | FK → contracts(id) |
| `payer_id` | `uuid` NOT NULL | FK → profiles(id) |
| `payee_id` | `uuid` NOT NULL | FK → profiles(id) |
| `order_id` | `text` UNIQUE NOT NULL | E-Kyash order reference |
| `invoice_id` | `text` UNIQUE | E-Kyash invoice reference |
| `transaction_id` | `text` UNIQUE | E-Kyash transaction reference |
| `amount_cents` | `integer` NOT NULL | Total amount |
| `platform_fee_cents` | `integer` NOT NULL | 3% fee |
| `donation_cents` | `integer` DEFAULT 0 | Optional community donation |
| `status` | `ekyash_status` DEFAULT 'pending' | pending, approved, cancelled, refunded |
| `created_at` | `timestamptz` DEFAULT now() | |
| `updated_at` | `timestamptz` DEFAULT now() | |

---

### donation_totals

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `total_cents` | `bigint` DEFAULT 0 | Running total |
| `updated_at` | `timestamptz` DEFAULT now() | |

Single row, incremented by trigger when `ekyash_transactions.status = 'approved'`.

---

### notifications

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` NOT NULL | FK → profiles(id) ON DELETE CASCADE |
| `title` | `text` NOT NULL | |
| `body` | `text` NOT NULL | |
| `data` | `jsonb` | Navigation data (contractId, postId, etc.) |
| `read` | `boolean` DEFAULT false | |
| `created_at` | `timestamptz` DEFAULT now() | |

---

### push_tokens

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` NOT NULL UNIQUE | FK → profiles(id) ON DELETE CASCADE |
| `token` | `text` NOT NULL | Expo push token |
| `created_at` | `timestamptz` DEFAULT now() | |
| `updated_at` | `timestamptz` DEFAULT now() | |

---

### waitlist

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `post_id` | `uuid` NOT NULL | FK → posts(id) ON DELETE CASCADE |
| `user_id` | `uuid` NOT NULL | FK → profiles(id) |
| `created_at` | `timestamptz` DEFAULT now() | |

**Unique:** `(post_id, user_id)` — one waitlist entry per user per post.

---

### email_receipts

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` NOT NULL | FK → profiles(id) |
| `contract_id` | `uuid` | FK → contracts(id) |
| `ekyash_txn_id` | `uuid` | FK → ekyash_transactions(id) |
| `type` | `text` NOT NULL | payment, refund, dispute |
| `resend_id` | `text` | Resend API response ID |
| `created_at` | `timestamptz` DEFAULT now() | |

**Known issue:** Both `contract_id` and `ekyash_txn_id` can be NULL (needs CHECK constraint).

---

### driver_details

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` NOT NULL UNIQUE | FK → profiles(id) ON DELETE CASCADE |
| `license_url` | `text` | Driver's license photo |
| `license_status` | `review_status` DEFAULT 'pending' | |
| `insurance_url` | `text` | Insurance document |
| `insurance_status` | `review_status` DEFAULT 'pending' | |
| `vehicle_make` | `text` | |
| `vehicle_model` | `text` | |
| `vehicle_year` | `integer` | |
| `vehicle_color` | `text` | |
| `license_plate` | `text` | |
| `created_at` | `timestamptz` DEFAULT now() | |
| `updated_at` | `timestamptz` DEFAULT now() | |

**RLS:** Owner can read/update own. Admins can read/update all.

---

### rider_documents

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` NOT NULL | FK → profiles(id) ON DELETE CASCADE |
| `document_url` | `text` NOT NULL | Storage URL |
| `document_type` | `text` NOT NULL | 'government_id', 'passport', etc. |
| `status` | `review_status` DEFAULT 'pending' | |
| `reviewed_by` | `uuid` | FK → profiles(id) |
| `reviewed_at` | `timestamptz` | |
| `created_at` | `timestamptz` DEFAULT now() | |

---

### flags

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `reporter_id` | `uuid` NOT NULL | FK → profiles(id) |
| `target_type` | `flag_target` NOT NULL | post, user, booking |
| `target_id` | `uuid` NOT NULL | Polymorphic — no FK constraint |
| `reason` | `flag_reason` NOT NULL | spam, scam, harassment, fake_account, safety, other |
| `description` | `text` | Max 500 chars |
| `status` | `flag_status` DEFAULT 'pending' | pending, reviewed, action_taken, dismissed |
| `reviewed_by` | `uuid` | FK → profiles(id) |
| `reviewed_at` | `timestamptz` | |
| `created_at` | `timestamptz` DEFAULT now() | |

**Known issue:** `target_id` has no FK constraint due to polymorphic pattern.

---

### admin_actions

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `admin_id` | `uuid` NOT NULL | FK → profiles(id) |
| `action` | `admin_action_type` NOT NULL | |
| `target_type` | `text` NOT NULL | |
| `target_id` | `uuid` NOT NULL | |
| `reason` | `text` | |
| `metadata` | `jsonb` | |
| `created_at` | `timestamptz` DEFAULT now() | |

Audit trail — immutable. RLS: admins only.

---

### driver_checkins

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `driver_id` | `uuid` NOT NULL | FK → profiles(id) ON DELETE CASCADE |
| `contract_id` | `uuid` NOT NULL | FK → contracts(id) ON DELETE CASCADE |
| `selfie_url` | `text` NOT NULL | |
| `lat` | `numeric(10,7)` | |
| `lng` | `numeric(10,7)` | |
| `created_at` | `timestamptz` DEFAULT now() | |

**Unique:** One check-in per driver per contract.

---

### contract_messages

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | |
| `contract_id` | `uuid` NOT NULL | FK → contracts(id) ON DELETE CASCADE |
| `sender_id` | `uuid` NOT NULL | FK → profiles(id) ON DELETE CASCADE |
| `body` | `text` NOT NULL | 1–2000 chars |
| `created_at` | `timestamptz` DEFAULT now() | |

**Realtime:** Enabled for real-time chat between contract parties.

**RLS:** Only contract parties can read/send.

---

## Migration Index

| # | File | Purpose |
|---|------|---------|
| 1 | `00001_profiles.sql` | profiles table, roles, account status |
| 2 | `00002_posts.sql` | posts table, post types |
| 3 | `00003_bookings_contracts.sql` | bookings, contracts |
| 4 | `00004_ratings_strikes.sql` | ratings, strikes, triggers |
| 5 | `00005_reports.sql` | road_reports, gas_prices |
| 6 | `00006_ekyash.sql` | ekyash_transactions, donation_totals |
| 7 | `00007_notifications.sql` | notifications table |
| 8 | `00008_email_receipts.sql` | email_receipts |
| 9 | `00009_rls_policies.sql` | RLS policies, driver_details, rider_documents |
| 10 | `00010_reports_update_policies.sql` | Report update RLS |
| 11 | `00011_job_fields.sql` | Job-specific columns on posts |
| 12 | `00012_push_tokens.sql` | push_tokens table |
| 13 | `00013_fix_email_receipts.sql` | Fix email_receipts constraints |
| 14 | `00014_driver_checkins.sql` | driver_checkins table |
| 15 | `00015_allow_author_delete_any_status.sql` | Author can delete own posts |
| 16 | `00016_contracts_cascade_delete.sql` | CASCADE on contract delete |
| 17 | `00017_add_route_metadata_columns.sql` | Route distance/duration/map URL |
| 18 | `00018_fuel_prices.sql` | Fuel price enhancements |
| 19 | `00019_drop_fuel_prices.sql` | Remove duplicate fuel table |
| 20 | `00020_fix_selfie_privacy.sql` | Selfie storage policy fix |
| 21 | `00021_road_report_gone_count.sql` | "It's gone" counter |
| 22 | `00022_road_reports_delete_policy.sql` | Delete policy for reports |
| 23 | `00023_route_offer_driver_fields.sql` | Vehicle fields on posts |
| 24 | `00024_profile_district_address.sql` | District/address on profiles |
| 25 | `00025_posts_payment_method.sql` | Payment method on posts |
| 26 | `00026_allow_email_signup.sql` | Email auth support |
| 27 | `00027_booking_flow_trigger.sql` | Booking confirmation trigger |
| 28 | `00028_fix_booking_flow.sql` | Booking flow fix |
| 29 | `00029_fix_contract_fk_timing.sql` | Contract FK timing fix |
| 30 | `00030_booking_completion_cascade.sql` | Booking completion cascade |
| 31 | `00031_unified_booking_flow.sql` | Unified booking flow |
| 32 | `00032_cron_schedules.sql` | pg_cron schedules |
| 33 | `00033_contract_messages.sql` | Contract messaging |
| 34 | `00034_message_notifications.sql` | Message notification triggers |
| 35 | `00035_phone_change_rate_limit.sql` | Phone change rate limiting |
| 36 | `00036_anonymous_ratings.sql` | Anonymous rating support |
| 37 | `00037_contract_completion_notifications.sql` | Contract completion notifications |
| 38 | `00038_activity_notifications.sql` | Activity notification triggers |
| 39 | `00039_profile_avatars.sql` | Profile avatar support |
| 40 | `00040_job_application_flow.sql` | Job application flow |
| 41 | `00041_secure_report_actions.sql` | Secure report action policies |
| 42 | `00042_deduplicate_upvotes.sql` | Deduplicate report upvotes |
| 43 | `00043_phone_change_rate_limit_trigger.sql` | Phone change rate limit trigger |
| 44 | `00044_profiles_public_view.sql` | Public profiles view |
| 45 | `00045_universal_applicant_review.sql` | Universal applicant review flow |
| 46 | `00046_gate_actions_behind_active_status.sql` | Gate actions behind active account status |
| 47 | `00047_contract_events.sql` | Contract events table |
| 48 | `00048_driver_documents.sql` | Driver documents table |
| 49 | `00049_remove_police_record.sql` | Remove police record requirement |
| 50 | `00050_phase2_audit_fixes.sql` | Phase 2 audit fixes |
