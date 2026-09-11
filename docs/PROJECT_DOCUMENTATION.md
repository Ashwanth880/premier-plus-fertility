# Premier Plus Fertility: Architecture and QA Guide

## 1. Purpose

Premier Plus Fertility is a patient self-registration and appointment-booking web application. It supports two primary workflows:

1. New patient registration, optional partner registration, and appointment booking.
2. Existing patient lookup followed by appointment booking.

The application is a browser frontend backed by an Express-for-Vite server. The Express server is the only application component that communicates with the clinic backend API and holds backend service credentials.

## 2. System Architecture

```text
+---------------------------+
| Browser                   |
| React + Vite             |
| App.jsx                  |
| api.js                   |
+-------------+-------------+
              |
              | same-origin /api requests
              v
+---------------------------+
| Application server        |
| Express + server.ts       |
| - request validation      |
| - rate limiting           |
| - security headers        |
| - token login/cache       |
| - API proxy               |
+-------------+-------------+
              |
              | Authorization: Bearer <server token>
              v
+---------------------------+
| Clinic backend API        |
| /auth/login               |
| /patients                 |
| /appointments             |
+-------------+-------------+
              |
              v
+---------------------------+
| Clinic database           |
+---------------------------+
```

### Trust boundaries

- The browser is untrusted. It can submit invalid or modified JSON, so the server validates important fields again.
- The Express server is the credential boundary. Backend credentials must never be placed in React code or `VITE_*` environment variables.
- The clinic backend is the source of truth for patient IDs, appointment IDs, authorization, and business rules.
- The browser does not persist patient or appointment records in localStorage and must not invent successful IDs.

## 3. Repository Structure

| Path | Responsibility |
| --- | --- |
| `src/App.jsx` | Main registration, lookup, booking, loading, error, and confirmation flow |
| `src/api.js` | Browser API client for `/api` routes; normalizes HTTP and network errors |
| `src/validation.js` | Client-side patient and appointment validation |
| `src/components/DateWheelPicker.jsx` | Date selection with current-date constraints |
| `src/components/TimePicker.jsx` | Appointment time selection and end-time ordering |
| `src/components/Logo.jsx` | Clinic branding |
| `src/main.tsx` | React bootstrap and error boundary |
| `server.ts` | Express server, validation, authentication, proxy routes, CSP, rate limit |
| `vite.config.ts` | Vite, React, Tailwind, and development server configuration |
| `index.html` | Vite source entrypoint; it must reference `/src/main.tsx` in source control |
| `.env.example` | Server configuration template |
| `README.md` | Quick start and high-level project notes |
| `docs/PROJECT_DOCUMENTATION.md` | Full architecture and QA documentation |

## 4. Runtime Flow

### 4.1 New patient flow

1. The user completes the patient form.
2. React validates required fields, phone number, DOB, and partner fields when the purpose is Fertility Consultation.
3. The frontend sends `POST /api/patients` to the local Express server.
4. Express validates the payload and obtains a backend JWT using the configured service account.
5. Express forwards the request to the clinic backend `POST /patients`.
6. The backend returns the real patient record and UUID.
7. If the purpose is Fertility Consultation, the frontend sends a second `POST /api/patients` for the partner.
8. The user proceeds to appointment booking only after the required patient records succeed.

### 4.2 Existing patient flow

1. The user enters a patient UUID or ID.
2. React calls `GET /api/patients/:id` through `src/api.js`.
3. Express authenticates and forwards the lookup.
4. If a valid record is returned, the user can proceed to appointment booking.
5. If lookup fails, the UI remains on the lookup screen and displays the backend error.

### 4.3 Appointment flow

1. The user selects a valid future date, start time, end time, appointment type, and reason.
2. React validates the form.
3. The frontend sends `POST /api/appointments` with the real backend patient UUID.
4. Express validates UUID, date, time ordering, type, and reason.
5. Express forwards the request to the clinic backend.
6. The confirmation view displays the returned appointment record and QR information.
7. A failed backend response never becomes a successful confirmation.

## 5. Configuration

Create `.env` from `.env.example` and configure server-only values:

```env
BACKEND_API_URL=http://13.204.230.143/api
BACKEND_ORIGIN=http://13.204.230.143
BACKEND_AUTH_EMAIL=your-service-account@example.com
BACKEND_AUTH_PASSWORD=your-secret
```

For production, replace the HTTP URL with HTTPS. HTTP exposes credentials, tokens, and patient information in transit.

Start development:

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

Validate and build:

```powershell
npm run lint
npm run build
```

Run the production bundle:

```powershell
$env:NODE_ENV = "production"
$env:BACKEND_API_URL = "https://your-clinic-api.example.com/api"
$env:BACKEND_ORIGIN = "https://your-clinic-api.example.com"
$env:BACKEND_AUTH_EMAIL = "your-service-account@example.com"
$env:BACKEND_AUTH_PASSWORD = "your-secret"
npm start
```

## 6. API Contract

The browser calls local same-origin routes. Express forwards them to the backend configured by `BACKEND_API_URL`.

### Health

```http
GET /api/health
```

Expected healthy response:

```json
{
  "status": "ok",
  "backendConnected": true,
  "mode": "proxy-active"
}
```

If credentials are missing or invalid, the server responds with `status: "degraded"` and `backendConnected: false`.

### Create patient

```http
POST /api/patients
Content-Type: application/json
```

Sample request:

```json
{
  "title": "Mr",
  "first_name": "Arun",
  "last_name": "Kumar",
  "full_name": "Mr Arun Kumar",
  "age": 31,
  "branch": "Kodambakkam",
  "date_of_birth": "1995-04-18",
  "gender": "male",
  "phone": "9876543210",
  "purpose": "Fertility Consultation",
  "referral_source": "Google"
}
```

The backend must return a record containing a real `id`. The exact additional response fields are owned by the clinic backend.

### Find patient

```http
GET /api/patients/{patient_uuid}
```

Sample UUID:

```text
12194d0d-c6c3-4022-8a1c-78bec57f309f
```

The UI expects a response shaped like:

```json
{
  "data": {
    "id": "12194d0d-c6c3-4022-8a1c-78bec57f309f",
    "patient_id": "PF12345",
    "full_name": "Mr Arun Kumar"
  }
}
```

### Create appointment

```http
POST /api/appointments
Content-Type: application/json
```

Sample request:

```json
{
  "patient_id": "12194d0d-c6c3-4022-8a1c-78bec57f309f",
  "doctor_id": null,
  "branch": "Kodambakkam",
  "appointment_date": "2026-09-15",
  "start_time": "10:00",
  "end_time": "10:30",
  "type": "consultation",
  "reason": "Initial fertility consultation"
}
```

Supported appointment types from the current server validation are:

```text
consultation
follow_up
routine_checkup
emergency
```

## 7. Validation Rules

### Patient

- `first_name`, `last_name`, `date_of_birth`, `gender`, `phone`, `branch`, and `purpose` are required.
- Date must be a real `YYYY-MM-DD` date.
- Phone must resolve to a 10-digit Indian mobile number beginning with 6, 7, 8, or 9.
- The frontend additionally requires a referral source.
- Fertility Consultation requires partner first name, last name, and date of birth in the frontend.

### Appointment

- `patient_id` must be a versioned UUID.
- `appointment_date` must be a real `YYYY-MM-DD` date.
- `start_time` and `end_time` must use `HH:MM`.
- End time must be later than start time.
- Appointment type must be supported.
- Reason must be non-empty.
- The frontend disallows past dates and past times on the current date.
- The backend remains authoritative for patient existence, appointment conflicts, branch rules, and any additional business constraints.

## 8. Manual Test Environment

Use two browser windows or one browser with DevTools open.

Before testing:

1. Set valid backend credentials in `.env`.
2. Start with `npm run dev`.
3. Open `http://localhost:3000`.
4. Open DevTools > Network and filter for `api`.
5. Confirm the browser requests `http://localhost:3000/api/...`, never the backend IP directly.
6. Record test date and time because current-date and current-time validation are dynamic.

Test data used below is synthetic. Do not use real patient data in development or screenshots.

## 9. Manual Test Cases

### A. Startup and health

| ID | Action / data | Expected result |
| --- | --- | --- |
| A01 | Run `npm run dev` | Server starts on port 3000 without compile errors. |
| A02 | Open `http://localhost:3000` | Application loads; no 404 asset errors, MIME errors, or CSP errors. |
| A03 | `GET /api/health` with valid credentials | HTTP 200; `status` is `ok`; `backendConnected` is `true`. |
| A04 | Remove credentials and restart | Health responds with degraded status; no password appears in the response or logs. |
| A05 | Run `npm run lint` | TypeScript validation exits with code 0. |
| A06 | Run `npm run build` | Vite and esbuild complete successfully; `dist/index.html` and `dist/server.cjs` are created. |

### B. New patient registration

| ID | Action / data | Expected result |
| --- | --- | --- |
| B01 | Use Arun Kumar data from the API section, with valid partner fields | One patient request succeeds; a real backend patient ID is shown. |
| B02 | Leave first name empty | Client validation shows first-name error; no network request is sent. |
| B03 | Use phone `5123456789` | Client validation rejects the phone number. |
| B04 | Use phone `9876543210` | Client validation accepts the phone number. |
| B05 | Set DOB to a date after the current date | Date picker prevents it or validation rejects it; no patient request is sent. |
| B06 | Select Fertility Consultation and leave partner first name empty | Partner validation appears; primary registration is not submitted. |
| B07 | Select a non-couple purpose and leave partner fields empty | Partner fields do not block registration. |
| B08 | Inspect successful request | Request is `POST /api/patients`; response contains backend data, not `_frontend`, `local-`, or generated browser IDs. |
| B09 | Submit the same patient twice | Backend duplicate policy is returned clearly; UI must not claim both are newly created unless the backend permits it. |

### C. Existing patient lookup

| ID | Action / data | Expected result |
| --- | --- | --- |
| C01 | Enter a known patient UUID | `GET /api/patients/{id}` succeeds and appointment step opens. |
| C02 | Enter `not-a-uuid` | Backend or server rejects it; user stays on lookup screen. No fake patient is created. |
| C03 | Enter a UUID that does not exist | Backend error is displayed; user cannot continue as that patient. |
| C04 | Stop the server and submit a lookup | Network/server error is shown; no fabricated patient record appears. |

### D. Appointment positive cases

Use a real patient UUID returned by the backend. Choose a future date such as `2026-09-15`, unless the test is run after that date.

| ID | Action / data | Expected result |
| --- | --- | --- |
| D01 | Date `2026-09-15`, start `10:00`, end `10:30`, type `consultation` | `POST /api/appointments` succeeds; confirmation screen appears. |
| D02 | Type `follow_up` | Request succeeds if backend permits it; confirmation displays the selected type. |
| D03 | Type `routine_checkup` | Request succeeds if backend permits it; confirmation displays the selected type. |
| D04 | Type `emergency` | Request succeeds if backend permits it; confirmation displays the selected type. |
| D05 | Confirm response and QR data | Appointment ID and patient ID are backend values; no fake IDs appear. |
| D06 | Refresh after confirmation | Behavior is acceptable and documented; the system must not silently create a second appointment. |

### E. Appointment negative cases

| ID | Input | Expected result |
| --- | --- | --- |
| E01 | Missing `patient_id` | HTTP 400 or backend validation error; no appointment created. |
| E02 | `patient_id: "not-a-uuid"` | HTTP 400 from the local server; backend is not called. |
| E03 | Invalid UUID `00000000-0000-0000-0000-000000000000` | Backend rejects it if it is not a real patient; no confirmation. |
| E04 | Date `2026-02-30` | HTTP 400 or client error; no appointment created. |
| E05 | Past date, for example `2020-01-01` | Client prevents submission or backend rejects it. |
| E06 | Start `11:00`, end `10:30` | Client/server rejects end-before-start. |
| E07 | Start `10:00`, end `10:00` | Client/server rejects equal times. |
| E08 | Start `10:00`, end `10:60` | HTTP 400; invalid time format. |
| E09 | Type `invalid_type` | HTTP 400 from local validation or backend rejection. |
| E10 | Empty reason | Client/server rejects the request. |
| E11 | Existing patient has a conflicting slot | Backend returns its conflict response; UI shows failure and remains bookable. |
| E12 | Unsupported branch | Backend branch rule is surfaced; no false confirmation. |

### F. Authentication and security

| ID | Action | Expected result |
| --- | --- | --- |
| F01 | Call external appointment API without Authorization | Backend returns unauthorized. |
| F02 | Call external appointment API with `Authorization: Bearer invalid` | Backend returns unauthorized. |
| F03 | Use the browser Network tab during normal use | Browser never sends service credentials or calls the backend IP directly. |
| F04 | Inspect `/api/health` response | It does not expose backend URL or token. |
| F05 | Send a request body larger than 32 KB | Express rejects it; application remains running. |
| F06 | Send more than 120 API requests in one minute from one client | Further requests receive HTTP 429. |
| F07 | Inspect response headers | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and CSP are present. |
| F08 | Search repository for passwords or tokens | No real secrets are committed; `.env` is ignored. |
| F09 | Stop external backend during a submission | UI shows a backend communication error; no fake success record is displayed. |

## 10. Useful PowerShell Checks

Start the server from the repository parent directory:

```powershell
Push-Location "premier-plus-fertility"
npm run dev
```

Health check:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/api/health
```

Invalid appointment validation check:

```powershell
$body = @{
  patient_id = "not-a-uuid"
  appointment_date = "2026-09-15"
  start_time = "11:00"
  end_time = "10:30"
  type = "invalid_type"
  reason = "Test"
} | ConvertTo-Json

Invoke-WebRequest -UseBasicParsing `
  -Method Post `
  -Uri http://localhost:3000/api/appointments `
  -ContentType "application/json" `
  -Body $body
```

Expected result: HTTP 400 and a validation error. The command may throw a PowerShell web exception for non-2xx responses; inspect the response body in the exception when needed.

## 11. Acceptance Criteria

The release is ready for integration testing when all of the following are true:

- The application starts without console asset, CSP, or MIME errors.
- `npm run lint` and `npm run build` pass.
- Health confirms backend connectivity with valid server credentials.
- A real patient can be created and its backend UUID is used for the appointment.
- A real appointment can be created and appears on the confirmation screen.
- Existing patient lookup rejects unknown IDs without fabricating records.
- Invalid appointment data is rejected before or by the backend.
- Unauthorized and invalid-token requests fail.
- No patient data, credentials, or tokens are stored in browser localStorage or exposed in frontend bundles.
- Production is deployed behind HTTPS with secrets supplied by a secret manager or protected environment configuration.

## 12. Known Operational Constraints

- The current supplied backend URL uses HTTP. It is not suitable for production patient data without a private trusted network or HTTPS migration.
- Backend-specific rules such as exact branch values, duplicate-patient behavior, time-slot availability, and response schemas remain authoritative on the clinic backend.
- The frontend cannot prove that an appointment is available until the backend accepts the booking.
- The service-account credentials must be provisioned before successful end-to-end creation and lookup tests can pass.
- The server uses an in-memory token cache and rate-limit map; use a shared cache and a proper reverse proxy when deploying multiple server instances.
