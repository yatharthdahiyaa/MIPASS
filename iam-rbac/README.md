# AWS IAM & RBAC Full-Stack Authentication System

An enterprise-grade, full-stack Role-Based Access Control (RBAC) authentication and identity management system modeled faithfully on the **Amazon Web Services (AWS) Management Console** sign-in and IAM experience.

---

## Architecture & Tech Stack

### Frontend
- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Vanilla CSS design tokens + Tailwind CSS with authentic AWS Console design system:
  - Header: `#232F3E` (AWS Dark Navy)
  - Accents: `#FF9900` (AWS Orange) & `#EC7211` (AWS Hover Orange)
  - Card Surfaces: Clean White & `#161E2E` (Dark Mode)
- **Routing:** React Router v6 with `<ProtectedRoute>` guards that evaluate granular permissions (`users:read`, `roles:read`, etc.)
- **Fine-Grained UI Controls:** `<Can action="..." resource="...">` component to dynamically hide or disable action buttons based on resolved policies.
- **Icons:** Lucide React

### Backend
- **Framework:** Node.js + Express + TypeScript
- **Database ORM:** PostgreSQL + Prisma ORM (with relational models, compound unique keys, indexes, and cascades)
- **Authentication:**
  - Short-lived Access Tokens (JWT, 15 min expiry)
  - Long-lived Refresh Tokens (7-day standard, 30-day "Remember this device")
  - Stored in `httpOnly`, `secure`, `SameSite: strict` cookies
  - Refresh token rotation on every use with SHA-256 database hashing
- **Password Security:**
  - Enforced 12+ characters, uppercase, lowercase, number, symbol
  - Hashed using **bcrypt** (cost factor 12) or Argon2id
  - Interactive live password strength meter with rule validation
- **Account Lockout & Rate Limiting:**
  - IP-based rate limiting on sensitive auth endpoints
  - Automatic 15-minute account lockout after 5 consecutive failed attempts
  - Anti-enumeration generic errors (`"Incorrect credentials"`)
- **Multi-Factor Authentication (MFA):**
  - RFC 6238 TOTP (Google Authenticator, Microsoft Authenticator, Authy, 1Password)
  - QR Code generator + manual secret key
  - 8 one-time cryptographic emergency backup codes
- **Validation:** Type-safe **Zod** schemas shared across client forms and server endpoints.
- **Security Headers:** Helmet, strict CORS policy with credential exchange, input sanitization.

---

## RBAC Authorization Model

The authorization engine implements the exact AWS IAM policy evaluation algorithm:

$$\text{Decision} = \begin{cases} \mathbf{DENY} & \text{if any statement explicitly denies} \\ \mathbf{ALLOW} & \text{if any statement explicitly allows} \\ \mathbf{DENY} & \text{otherwise (implicit Default Deny)} \end{cases}$$

### Key Evaluation Rules:
1. **Explicit Deny Overrides All:** If any attached policy (via direct role or inherited from group) specifies `"Effect": "Deny"`, the action is unconditionally denied, even if another policy has an `"Effect": "Allow"`.
2. **Explicit Allow Required:** Access is only permitted if at least one attached statement specifies `"Effect": "Allow"`.
3. **Implicit Default Deny:** If neither an explicit allow nor an explicit deny matches, the request is denied by default.
4. **Wildcards Supported:**
   - Actions support single-segment and recursive wildcards (e.g. `users:*` matches `users:read`, `users:create`, `users:delete`).
   - Resources support wildcard patterns (e.g. `arn:aws:s3:::*` or `*`).
5. **Root User Superuser Bypass:** The initial account creator ("Root User") possesses unconditional bypass for all operations.

### Default System Roles & Policies:
| Role Name | Description | Policy Attached |
|---|---|---|
| **Root** | Account Owner with unrestricted access | `AdministratorAccess` (`*` on `*`) |
| **Admin** | Manages IAM users, roles, groups, and policies | `IAMFullAccess` (`users:*`, `roles:*`, `policies:*`, `groups:*`, `audit:read`) |
| **Developer** | Resource write and read access without IAM mutations | `DeveloperAccess` (`compute:*`, `storage:*`, `users:read`, `roles:read`) |
| **Billing** | Read/write access to financial and cost reports | `BillingAccess` (`billing:*`) |
| **ReadOnly** | View-only permissions across all services | `ReadOnlyAccess` (`*:read`, `*:view`, `*:list`) |

---

## Directory Structure

```
iam-rbac/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma            # 13 tables (Account, User, Role, Policy, AuditLog, etc.)
│   │   └── seed.ts                  # Seeds root@aws-example.com, roles, policies, sample user
│   ├── src/
│   │   ├── config/                  # Prisma client and Zod env validation
│   │   ├── controllers/             # Auth, Users, Roles, Policies, Groups, Audit controllers
│   │   ├── middlewares/             # requireAuth, requirePermission, rateLimit, zodValidate
│   │   ├── routes/                  # Express route definitions
│   │   ├── services/                # TOTP MFA, audit logger, RBAC resolver
│   │   ├── utils/                   # Policy evaluation engine, JWT cookies, password hashing
│   │   ├── app.ts                   # Express application setup
│   │   └── server.ts                # HTTP server bootstrap
│   ├── tests/
│   │   ├── rbac.test.ts             # 12 unit tests for AWS IAM evaluation algorithm
│   │   └── auth.middleware.test.ts  # Token extraction and permission verification tests
│   ├── .env.example
│   ├── jest.config.js
│   └── package.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── api/                     # Axios/fetch client with credentials and automatic refresh
│   │   │   ├── client.ts
│   │   │   ├── auth.ts
│   │   │   └── iam.ts
│   │   ├── components/
│   │   │   ├── common/              # ProtectedRoute, Can, Modal, PasswordStrengthMeter, Badge
│   │   │   └── layout/              # Navbar (AWS dark navy header), Sidebar, AppLayout
│   │   ├── context/                 # AuthContext (user, permissions, can, hasRole) & ThemeContext
│   │   ├── pages/
│   │   │   ├── auth/                # Sign-up, Sign-in Step 1 & 2, MFA, Verify Email, Forgot/Reset
│   │   │   ├── dashboard/           # IAM Dashboard with Live Policy Simulator, AccessDenied 403
│   │   │   └── iam/                 # UsersPage, RolesPage, PoliciesPage, GroupsPage, AuditLogsPage
│   │   ├── types/                   # TypeScript schemas for Auth and IAM
│   │   ├── utils/                   # Client-side policy evaluator
│   │   ├── App.tsx                  # React Router 6 configuration
│   │   ├── index.css                # AWS Tailwind tokens and styling
│   │   └── main.tsx
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── package.json
│
├── postman_collection.json          # Complete Postman collection for all endpoints
└── README.md
```

---

## Setup & Running Instructions

### Prerequisites
- **Node.js** >= 18 (Tested on Node 20 & 25)
- **PostgreSQL** (Local instance or Docker / Neon / Supabase)

---

### 1. Database Setup

Create a PostgreSQL database named `iam_rbac`:
```bash
createdb iam_rbac
```

---

### 2. Backend Setup

1. Open a terminal in `backend/`:
   ```bash
   cd iam-rbac/backend
   npm install
   ```

2. Configure environment variables:
   Copy `.env.example` to `.env`:
   ```env
   PORT=5000
   NODE_ENV=development
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/iam_rbac?schema=public"
   JWT_ACCESS_SECRET="super-secret-jwt-access-key-minimum-32-chars-long"
   JWT_REFRESH_SECRET="super-secret-jwt-refresh-key-minimum-32-chars-long"
   CLIENT_URL="http://localhost:5173"
   BCRYPT_ROUNDS=12
   ACCOUNT_LOCKOUT_DURATION_MINUTES=15
   MAX_FAILED_LOGIN_ATTEMPTS=5
   ```

3. Run Prisma migrations and generate the Prisma Client:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

4. Seed the database with default roles, policies, and Root account:
   ```bash
   npm run prisma:seed
   ```

5. Start the backend development server:
   ```bash
   npm run dev
   ```
   Backend will start on `http://localhost:5000`.

---

### 3. Frontend Setup

1. Open a second terminal in `frontend/`:
   ```bash
   cd iam-rbac/frontend
   npm install
   ```

2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Frontend will open at `http://localhost:5173`.

---

## Default Seeded Accounts

The seed script creates the following pre-configured identities:

| Account Type | Identifier / Email | Account Alias | Password | Roles |
|---|---|---|---|---|
| **Root User** | `root@aws-example.com` | `aws-demo` | `SuperSecret#Root2026!` | `Root` (Unrestricted) |
| **IAM User** | `alice.dev` | `aws-demo` | `DeveloperPass#2026!` | `Developer` |

---

## Pages & User Experience Walkthrough

1. **Sign-up (`/signup`):**
   - Create organization account + Root email.
   - Live password meter checking length (>= 12), uppercase, lowercase, numbers, and symbols.
   - Issues 64-character tokenized email verification link.
2. **Sign-in Step 1 (`/signin`):**
   - Choose between **Root User** (Email) and **IAM User** (12-digit Account ID or Alias + Username).
   - Prevents account enumeration through generic responses.
3. **Sign-in Step 2 (`/signin/step2`):**
   - Password entry screen with show/hide eye toggle.
   - "Remember this device for 30 days" checkbox.
   - Account lockout notification upon 5 failed attempts (15-minute lock).
4. **MFA Prompt (`/signin/mfa`):**
   - Prompts for 6-digit TOTP code if enabled on identity.
   - Fallback button: "Lost your phone? Use one-time backup emergency code".
5. **Console Dashboard (`/dashboard`):**
   - AWS Console Header with Dark Navy bar, Account ID dropdown, Role badge, and Region badge.
   - IAM resource counters (Users, Roles, Groups, Policies).
   - **Interactive Live Policy Simulator**: Type any action (`users:create`, `billing:read`, `ec2:start`) to inspect the engine's live ALLOW/DENY decision against your active role statements.
6. **Access Denied (`/403` or `/access-denied`):**
   - AWS Console style 403 page explaining why the request failed (Explicit Deny vs Default Implicit Deny).
7. **IAM Management Pages:**
   - `/users`: Add user, suspend/activate user, admin password reset, assign roles & groups.
   - `/roles`: Create custom roles, attach/detach JSON policies.
   - `/policies`: Create JSON policy documents, view formatted policy document with syntax highlighting.
   - `/groups`: Create user groups and manage membership inheritance.
   - `/audit-logs`: Live AWS CloudTrail style stream of sign-ins, IP addresses, user agents, and authorization verdicts.

---

## Running Automated Tests

Run backend unit tests for the policy evaluation engine and authentication middleware:
```bash
cd iam-rbac/backend
npm test
```

Included test suites:
- `tests/rbac.test.ts`:
  - Default Deny when no statements match
  - Explicit Allow for matching action and resource
  - Explicit Deny overrides Allow
  - Wildcard action matching (`users:*` matching `users:create`)
  - Root user superuser bypass
  - Multiple statements evaluation
- `tests/auth.middleware.test.ts`:
  - Access token extraction from cookies and headers
  - Rejection of expired or tampered tokens
  - `requirePermission` middleware evaluation
