# Admin Panel

Next.js 15.2.4 admin dashboard in the `admin/` directory. Separate app with its own `package.json`.

---

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 15.2.4 | App Router |
| React | 19.0.0 | UI |
| Supabase SSR | 0.5.2 | Server-side auth |
| Supabase JS | ^2.49.1 | Client SDK |
| Tailwind CSS | 4.1.3 | Styling |
| TypeScript | 5.7.0 | Type safety |

---

## Setup

```bash
cd admin
npm install
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm run dev    # localhost:3001
```

---

## Routes

| Page | Route | Purpose |
|------|-------|---------|
| Login | `/login` | Phone OTP authentication |
| Dashboard | `/(admin)/` | Stats overview, recent actions |
| Driver Queue | `/(admin)/drivers` | Pending driver approvals (license, insurance, vehicle) |
| Rider Queue | `/(admin)/riders` | Pending rider document reviews |
| Flagged Posts | `/(admin)/posts` | Community-flagged content |
| Users | `/(admin)/users` | User management, strikes, suspensions |
| Transactions | `/(admin)/transactions` | E-Kyash transaction review |
| Flags | `/(admin)/flags` | All community flags |
| Flag Detail | `/(admin)/flags/[id]` | Individual flag review with actions |
| Admins | `/(admin)/admins` | Admin user management, invite new admins |
| Driver Detail | `/(admin)/drivers/[id]` | Individual driver review with document actions |
| Rider Detail | `/(admin)/riders/[id]` | Individual rider review with document actions |
| User Detail | `/(admin)/users/[id]` | Individual user management with strike/suspend actions |

---

## API Routes

All admin API routes verify the user has `role = 'admin'` before processing.

| Endpoint | Method | Purpose |
|----------|--------|----------|
| `/api/drivers/review` | POST | Approve or reject driver application |
| `/api/riders/review` | POST | Approve or reject rider document |
| `/api/users/action` | POST | Issue strike, suspend, or unsuspend user |
| `/api/flags/action` | POST | Dismiss or take action on flag |
| `/api/admins/invite` | POST | Invite a new admin user |

---

## Authentication

Admin access is protected by middleware (`admin/middleware.ts`):

```typescript
// Checks:
// 1. Valid Supabase session exists
// 2. User's profile has role = 'admin'
// If not, redirects to /login?error=unauthorized
```

The admin panel uses `SUPABASE_SERVICE_ROLE_KEY` for server-side operations that bypass RLS (e.g., reviewing documents, issuing strikes).

---

## Dashboard Widgets

- Total registered users
- Pending driver approvals (count + queue link)
- Pending rider document reviews
- Open community flags
- Active posts
- Completed trips
- Recent admin actions log (last 10 actions with who/what/when/target/reason)

---

## Key Components

| Component | File | Purpose |
|-----------|------|---------|
| `Sidebar` | `admin/components/Sidebar.tsx` | Navigation sidebar |
| `PageHeader` | `admin/components/PageHeader.tsx` | Page title + actions |
| `StatusBadge` | `admin/components/StatusBadge.tsx` | Color-coded status pills |
| `Icons` | `admin/components/Icons.tsx` | Admin icon set |

---

## Commands

```bash
cd admin
npm run dev        # Development (localhost:3001)
npm run build      # Production build
npm start          # Production server
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```
