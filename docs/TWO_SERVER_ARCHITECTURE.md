# Premier Plus Fertility: Two-Server Architecture

This document describes the standalone Express backend and Vite frontend introduced for the project. The previous project documentation remains unchanged; this file is the source of truth for the two-server setup.

## 1. What Changed

The project now runs as two separate processes:

```text
Browser
  |
  | http://localhost:3000
  v
Vite React frontend
  |
  | development proxy: /api -> http://127.0.0.1:4000
  v
Express backend
  |
  | MySQL transactions, authentication, and scheduling
  v
MySQL database
```

The frontend contains no clinic password, service token, or backend credential. The backend owns authentication, validation, persistence, and API behavior.

## 2. File Structure

```text
premier-plus-fertility/
├── backend/
│   ├── data/              Legacy JSON import input and reports
│   ├── migrations/        MySQL schema migrations
│   └── src/
│       ├── app.js          Express app, routes, middleware
│       ├── config.js       Environment configuration
│       ├── password.js     scrypt password hashing and verification
│       ├── server.js       Backend process entrypoint
│       ├── mysql.js        MySQL pool and migration runner
│       ├── mysql-store.js  Patient, slot, and appointment repository
│       ├── scheduling.js   15-minute slot and lunch rules
│       ├── import-json.js  Legacy JSON migration tool
│       ├── token.js        Signed expiring access tokens
│       └── validation.js   Patient and appointment validation
├── src/
│   ├── App.jsx             Existing registration and booking workflow
│   ├── api.js              Browser API client
│   └── components/         Date, time, and branding components
├── docs/
│   ├── PROJECT_DOCUMENTATION.md
│   └── TWO_SERVER_ARCHITECTURE.md
├── vite.config.ts          Frontend server and /api proxy
└── package.json             Separate frontend/backend scripts
```

MySQL is the source of truth. The legacy JSON files are migration input only and are not used by the production backend.

## 3. Configuration

Copy `.env.example` to `.env`:

```env
BACKEND_PORT=4000
BACKEND_HOST=127.0.0.1
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=premier_plus_fertility
MYSQL_CONNECTION_LIMIT=10
CLINIC_TIMEZONE=Asia/Kolkata
CLINIC_OPENING_TIME=08:00
CLINIC_CLOSING_TIME=20:00
CLINIC_LUNCH_START=11:30
CLINIC_LUNCH_END=12:30
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-characters
TOKEN_TTL_SECONDS=3600
DATA_DIRECTORY=backend/data
CORS_ORIGIN=http://localhost:3000
VITE_API_TARGET=http://127.0.0.1:4000
```

Create the database, apply the schema, and import legacy records:

```sql
CREATE DATABASE premier_plus_fertility CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```powershell
npm run db:migrate
npm run db:import-json
```

The importer preserves valid IDs and writes a quarantine report for duplicate phone numbers, invalid durations/lunch overlaps, missing patients, and slot conflicts.

There is no permanent admin email or password in `.env`. The `.env` file contains only server configuration and the token-signing secret. The first administrator is created once through the local CLI; the password is hashed with Node.js `scrypt` and only the hash is stored in `backend/data/users.json`.

Generate a strong secret in PowerShell:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Do not commit `.env`, `backend/data/users.json`, patient data, appointment data, passwords, or tokens.

## 3.1 Create the First Administrator

Run this command from the project root before starting the backend:

```powershell
npm run admin:create
```

Enter the admin email, full name, password, and password confirmation in the terminal. The password is hidden while typing. Use a dedicated clinic administrator email and a unique password of at least 12 characters.

The command creates a user with role `admin` and stores only a password hash in MySQL. It does not write the plaintext password to source code, `.env`, or logs.

After the first admin exists:

1. Start the backend with `npm run dev:backend`.
2. Log in through `POST /api/auth/login`.
3. Use the returned bearer token to call `POST /api/admin/users` when creating staff or additional administrators.
4. Do not add admin credentials to frontend code.

## 4. Start the Two Servers

Install packages:

```powershell
npm install
```

The simplest option starts both processes together:

```powershell
npm run dev
```

This runs the backend on port 4000 and the frontend on port 3000. You can also run them independently in two terminals as shown below.

Terminal 1, backend:

```powershell
npm run dev:backend
```

Expected:

```text
Backend listening on http://127.0.0.1:4000
```

Terminal 2, frontend:

```powershell
npm run dev:frontend
```

Open:

```text
http://localhost:3000
```

The frontend calls `/api/...`. Vite forwards those requests to the backend. This avoids CORS problems during development while keeping the processes separate.

For a production deployment, put both services behind an HTTPS reverse proxy and route `/api` to port 4000 and frontend traffic to the built static frontend.

## 5. Backend API

### Health

```http
GET http://127.0.0.1:4000/api/health
```

Response:

```json
{
  "status": "ok",
  "service": "premier-plus-fertility-backend"
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "service-account@example.com",
  "password": "the-password-created-by-admin:create"
}
```

Response:

```json
{
  "access_token": "signed-token",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### Admin-managed users

After logging in as an administrator, create a staff or additional admin account:

```http
POST /api/admin/users
Authorization: Bearer <admin-token>
Content-Type: application/json
```

```json
{
  "email": "staff@clinic.example",
  "password": "a-new-password-at-least-12-chars",
  "full_name": "Clinic Staff",
  "role": "staff"
}
```

Allowed roles are `staff` and `admin`. Public signup is intentionally unavailable.

### Patient routes

```text
POST /api/patients       kiosk registration; validates and stores a patient
GET  /api/patients/:id   kiosk lookup by UUID or patient ID
GET  /api/patients       authenticated staff listing
```

### Appointment routes

```text
POST /api/appointments      kiosk booking; validates patient and slot
GET  /api/appointments      authenticated staff listing
GET  /api/appointments/:id  authenticated staff lookup
GET  /api/availability      server-approved available 15-minute slots
POST /api/appointments/:id/cancel       staff/admin cancellation
POST /api/appointments/:id/reschedule   staff/admin rescheduling
```

The kiosk create, lookup, and booking routes are intentionally callable by the browser because a public patient kiosk cannot safely contain a staff token. Protect them at deployment with HTTPS, clinic network access, WAF/rate limiting, and monitoring. Listing, cancellation, and rescheduling routes remain token-protected.

Booking requires an `Idempotency-Key` header. The same key and payload replays the original response; reusing a key with a different payload is rejected. Branch slot locks ensure concurrent requests for the same branch/date/start time produce one booking and a `409 SLOT_UNAVAILABLE` response for the loser.

## 6. Existing Frontend Compatibility

The existing React application continues to use:

```text
POST /api/patients
GET  /api/patients/:id
POST /api/appointments
```

The backend returns the shapes already expected by `src/App.jsx`:

```json
{
  "data": {
    "id": "uuid",
    "patient_id": "PF12345",
    "full_name": "Mr Arun Kumar",
    "branch": "Kodambakkam"
  }
}
```

Appointment records contain:

```json
{
  "data": {
    "id": "uuid",
    "patient_id": "patient-uuid",
    "appointment_date": "2026-09-15",
    "start_time": "10:00",
    "end_time": "10:30",
    "type": "consultation",
    "status": "scheduled"
  }
}
```

## 7. Security Model

- Passwords are hashed using `scrypt`; plaintext passwords are not stored.
- Access tokens are signed with `JWT_SECRET` and expire.
- Staff listing routes require `Authorization: Bearer <token>`.
- JSON request bodies are limited to 32 KB.
- API requests are rate-limited per client IP.
- Basic security headers are set on every response.
- Invalid UUIDs, dates, times, phone values, types, and appointment ordering are rejected.
- Duplicate appointment slots for the same patient return HTTP 409.
- Public signup is disabled by default.
- Patient and appointment data is not stored in browser localStorage.

For production, replace JSON storage with a database, use HTTPS, use a secret manager, configure a reverse proxy/WAF, add audit logging with PII redaction, and restrict access to the kiosk routes.

## 8. Verification

Run static checks:

```powershell
npm run lint
npm run build
```

Test backend health:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4000/api/health
```

Test login:

```powershell
$login = @{ email = "admin@clinic.example"; password = "the-password-used-with-admin:create" } | ConvertTo-Json
Invoke-WebRequest -UseBasicParsing -Method Post `
  -Uri http://127.0.0.1:4000/api/auth/login `
  -ContentType application/json -Body $login
```

Test the full frontend flow at `http://localhost:3000`:

1. Register a new patient.
2. If purpose is Fertility Consultation, confirm the partner is created.
3. Select a future date and valid time window.
4. Submit the appointment.
5. Confirm the returned patient and appointment IDs appear.
6. Reset and use Existing Patient Booking with the returned patient UUID.
7. Try an invalid UUID, invalid date, end time before start time, invalid type, and duplicate slot.
8. Confirm each invalid case is rejected without a false confirmation.

## 9. Operational Limitations

- JSON files do not support concurrent multi-process writes or horizontal scaling.
- The current kiosk endpoints are public at the application layer; infrastructure access controls are required for production.
- A browser cannot securely use the staff service-account token. This is why staff listing routes are separate from kiosk create/lookup routes.
- The backend entrypoint is `backend/src/server.js`; the frontend entrypoint is Vite's `src/main.tsx`.
