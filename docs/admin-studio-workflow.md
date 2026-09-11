# Admin Operations — Supabase Studio Workflow

> Note: Day-to-day admin operations (user moderation, driver approvals, transaction ledgers) are managed via the dedicated **Kanek Admin Portal** at `kanek.bz/admin` (backed by the `admin-api` edge function).  
> The Supabase Studio workflows and SQL stored procedures documented below serve as direct database-level administration and emergency operations.  
> Migration: `supabase/migrations/00002_admin_studio_migration.sql`

---

## Access

1. Go to **https://supabase.com/dashboard/project/tlggdherqjvybpddsqjj**
2. Sign in with your Supabase account (must have **Administrator** or **Owner** role on the project)
3. Roles map:
   - **Owner** — full access, billing, danger zone
   - **Administrator** — can use SQL Editor, Table Editor, Auth, Storage (recommended for admins)
   - **Developer** — can view data but should not perform admin actions
   - **Read-Only** — view only, no writes

---

## Dashboard Stats

**Where:** SQL Editor → New query

```sql
SELECT * FROM admin_dashboard_stats;
```

Returns a single row:

| Column | Description |
|--------|-------------|
| `total_users` | All registered users |
| `pending_drivers` | Driver applications awaiting review |
| `pending_rider_docs` | Rider ID documents awaiting review |
| `pending_flags` | Community flags awaiting moderation |
| `active_posts` | Posts that are open, activated, or in-progress |
| `completed_contracts` | Total completed contracts |

---

## Review Driver Applications

### View queue

**Table Editor** → `admin_drivers_list` (sorted pending-first)

Or via SQL:
```sql
SELECT * FROM admin_drivers_list WHERE review_status = 'pending';
```

### View driver documents

1. **Table Editor** → `driver_details` → find the driver row
2. Copy the `license_url`, `insurance_url`, or `id_document_url` value
3. **Storage** → navigate to the bucket/path to preview the file

### Approve a driver

```sql
SELECT admin_review_driver(
  'DRIVER-UUID',    -- driver_details.id (same as profile id)
  'approve',
  NULL,             -- no reason needed for approval
  'YOUR-ADMIN-UUID' -- your profile id
);
```

**What happens:** driver_details → approved + verified, profile → active, notification sent, audit logged.

### Reject a driver

```sql
SELECT admin_review_driver(
  'DRIVER-UUID',
  'reject',
  'Blurry license photo — please re-upload a clear image',
  'YOUR-ADMIN-UUID'
);
```

**What happens:** driver_details → rejected + reason stored, notification sent with reason, audit logged.

---

## Review Rider ID Documents

### View queue

**Table Editor** → `admin_rider_docs_list` (sorted pending-first)

### View document image

1. Copy the `document_url` value from the row
2. **Storage** → navigate to the bucket/path to preview

### Approve a rider document

```sql
SELECT admin_review_rider_doc(
  'DOC-UUID',       -- rider_documents.id
  'approve',
  NULL,
  'YOUR-ADMIN-UUID'
);
```

**What happens:** rider_documents → approved + verified, profile → active, notification sent, audit logged.

### Reject a rider document

```sql
SELECT admin_review_rider_doc(
  'DOC-UUID',
  'reject',
  'ID photo too blurry — please re-upload',
  'YOUR-ADMIN-UUID'
);
```

---

## User Management

### View all users

**Table Editor** → `profiles` (or filter by `account_status`, `role`, etc.)

### Suspend a user

```sql
SELECT admin_user_action(
  'USER-UUID',
  'suspend',
  'Repeated no-shows and community complaints',
  'YOUR-ADMIN-UUID'
);
```

**What happens:** profile → suspended, notification sent with reason, audit logged. Cannot suspend admin accounts.

### Unsuspend a user

```sql
SELECT admin_user_action(
  'USER-UUID',
  'unsuspend',
  NULL,
  'YOUR-ADMIN-UUID'
);
```

### Approve a user (with pending rider docs)

```sql
SELECT admin_user_action(
  'USER-UUID',
  'approve',
  NULL,
  'YOUR-ADMIN-UUID'
);
```

**What happens:** profile → active, all pending rider_documents → approved, notification sent, audit logged.

---

## Moderate Community Flags

### View queue

**Table Editor** → `admin_flags_list` (sorted pending-first)

### View flag details (with target info)

```sql
SELECT * FROM admin_flag_detail WHERE id = 'FLAG-UUID';
```

Returns: flag info + reporter name + target info (post title/status/author if post-type, user name/status if user-type).

### Dismiss a flag

```sql
SELECT admin_moderate_flag(
  'FLAG-UUID',
  'dismiss',
  'Not actionable — no violation found',
  'YOUR-ADMIN-UUID'
);
```

### Remove a flagged post

```sql
SELECT admin_moderate_flag(
  'FLAG-UUID',
  'remove_post',
  'Spam content',
  'YOUR-ADMIN-UUID'
);
```

**Requires:** flag must be targeting a post (`target_type = 'post'`).  
**What happens:** post → cancelled, author notified, flag → action_taken, audit logged.

### Suspend a flagged user

```sql
SELECT admin_moderate_flag(
  'FLAG-UUID',
  'suspend_user',
  'Harassment — multiple reports',
  'YOUR-ADMIN-UUID'
);
```

**Requires:** flag must be targeting a user (`target_type = 'user'`). Cannot suspend admins.  
**What happens:** profile → suspended, user notified, flag → action_taken, audit logged.

### Issue a strike from a flag

```sql
SELECT admin_moderate_flag(
  'FLAG-UUID',
  'issue_strike',
  'First offense warning',
  'YOUR-ADMIN-UUID'
);
```

**Works for both post and user flags.** If the flag targets a post, the strike goes to the post author.  
**What happens:** soft strike inserted, user notified, flag → action_taken, audit logged.

---

## Transactions

### View all transactions

**Table Editor** → `admin_transactions_list` (newest first)

### Check donation total

```sql
SELECT total_cents FROM donation_totals WHERE id = 1;
```

---

## Audit Log

### View recent admin actions

**Table Editor** → `admin_recent_actions` (newest first)

Or filter by admin:
```sql
SELECT * FROM admin_recent_actions WHERE admin_first_name = 'YourName';
```

---

## Posts

### Browse all posts

**Table Editor** → `admin_posts_list` (newest first)

---

## Create Admin User

1. **Authentication** → **Users** → **Add user** → Create with email + password
2. **Table Editor** → `profiles` → Find the new row (match by `id` from Auth user)
3. Edit the row: set `role` = `admin`, `first_name`, `last_name`, `account_status` = `active`
4. (Optional) Log the action in SQL Editor:
   ```sql
   INSERT INTO admin_actions (admin_id, action, target_type, target_id, reason)
   VALUES ('YOUR-ADMIN-UUID', 'invite_admin', 'profiles', 'NEW-ADMIN-UUID', 'New admin onboarded');
   ```

---

## Finding Your Admin UUID

Your admin UUID is your `profiles.id`. To find it:
1. **Authentication** → **Users** → find your email → copy the **User UID**
2. Or: `SELECT id, first_name, last_name FROM profiles WHERE role = 'admin';`

---

## Quick Reference

| Task | Method |
|------|--------|
| Dashboard stats | `SELECT * FROM admin_dashboard_stats;` |
| Pending drivers | Table Editor → `admin_drivers_list` |
| Pending rider docs | Table Editor → `admin_rider_docs_list` |
| Pending flags | Table Editor → `admin_flags_list` |
| Flag detail | `SELECT * FROM admin_flag_detail WHERE id = '...';` |
| All transactions | Table Editor → `admin_transactions_list` |
| Audit log | Table Editor → `admin_recent_actions` |
| All posts | Table Editor → `admin_posts_list` |
| Approve driver | `SELECT admin_review_driver('...', 'approve', NULL, '...');` |
| Reject driver | `SELECT admin_review_driver('...', 'reject', 'reason', '...');` |
| Approve rider doc | `SELECT admin_review_rider_doc('...', 'approve', NULL, '...');` |
| Reject rider doc | `SELECT admin_review_rider_doc('...', 'reject', 'reason', '...');` |
| Suspend user | `SELECT admin_user_action('...', 'suspend', 'reason', '...');` |
| Unsuspend user | `SELECT admin_user_action('...', 'unsuspend', NULL, '...');` |
| Approve user | `SELECT admin_user_action('...', 'approve', NULL, '...');` |
| Dismiss flag | `SELECT admin_moderate_flag('...', 'dismiss', 'reason', '...');` |
| Remove flagged post | `SELECT admin_moderate_flag('...', 'remove_post', 'reason', '...');` |
| Suspend flagged user | `SELECT admin_moderate_flag('...', 'suspend_user', 'reason', '...');` |
| Issue strike from flag | `SELECT admin_moderate_flag('...', 'issue_strike', 'reason', '...');` |
| Create admin | Auth → Add user, then edit profile row |
| View document | Storage browser → navigate to file path |
| Donation total | `SELECT total_cents FROM donation_totals WHERE id = 1;` |
