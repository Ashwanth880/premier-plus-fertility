# Premier Plus Fertility

Patient self-registration and appointment booking for the Premier Plus Fertility clinic.

## Architecture

```text
React/Vite browser app
   |
   | same-origin /api requests
   v
Express server (server.ts)
   |
   | service-account authentication and proxying
   v
Clinic backend API
   |
   v
Clinic database
```

The browser never receives the backend service-account credentials. `server.ts` obtains a token from the clinic API and forwards patient and appointment requests. The frontend does not use localStorage or create fake patient/appointment IDs.

## User workflow

1. A new patient enters personal, contact, branch, and purpose information.
2. Fertility Consultation also creates the partner as a second backend patient record.
3. The patient selects a future appointment date, time, type, and reason.
4. The backend creates the appointment and returns the real appointment record.
5. The confirmation screen displays the backend patient and appointment identifiers and generates the check-in QR code.
6. An existing patient can look up their record and proceed directly to booking.

## API routes used by the application

The frontend calls the local Express routes below. Express forwards them to the configured backend API.

| Local route | Backend route | Purpose |
| --- | --- | --- |
| `GET /api/health` | authentication check | server/backend health |
| `POST /api/patients` | `POST /patients` | create a patient |
| `GET /api/patients/:id` | `GET /patients/:id` | find an existing patient |
| `POST /api/appointments` | `POST /appointments` | create an appointment |

The proxy returns backend status codes and error bodies. It does not report a booking as successful when the backend is unavailable or rejects the request.

## Configuration

Copy `.env.example` to `.env` and set real server-side values:

```env
BACKEND_API_URL=https://your-clinic-api.example.com/api
BACKEND_ORIGIN=https://your-clinic-api.example.com
BACKEND_AUTH_EMAIL=service-account@example.com
BACKEND_AUTH_PASSWORD=use-a-secret-manager-value
```

The supplied `http://13.204.230.143/api` URL is supported for integration testing, but HTTP exposes credentials and patient data in transit. Production deployment must use HTTPS or a trusted private network/VPN.

Do not commit `.env`, credentials, access tokens, or patient data. The repository ignores environment files by default.

## Run locally

Prerequisite: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The `dev` command starts Express and Vite together, so `/api` requests use the same origin and do not require browser CORS configuration.

## Build and run production output

```bash
npm run lint
npm run build
BACKEND_API_URL=https://your-clinic-api.example.com/api npm start
```

On Windows PowerShell, set environment variables before starting:

```powershell
$env:BACKEND_API_URL = "https://your-clinic-api.example.com/api"
$env:BACKEND_ORIGIN = "https://your-clinic-api.example.com"
$env:BACKEND_AUTH_EMAIL = "service-account@example.com"
$env:BACKEND_AUTH_PASSWORD = "your-secret"
npm start
```

## Security behavior

- Backend credentials stay on the Express server.
- Request bodies are limited to 32 KB.
- Basic security response headers are enabled.
- API requests are rate-limited per client IP.
- Patient and appointment payloads are validated before proxying.
- Appointment `patient_id` must be a UUID, dates must be valid `YYYY-MM-DD`, times must be valid `HH:MM`, and appointment type must be one of the supported UI values.
- Failed backend requests are returned as failures; there is no in-memory or browser fallback success path.
- The service account is logged in, but never automatically created by the application.

For production, put the server behind HTTPS, a reverse proxy/WAF, centralized logging with PII redaction, monitoring, and a secret manager. The service account should have only the permissions required by these routes.

## Manual testing checklist

1. Set valid backend credentials and run `npm run dev`.
2. Open `http://localhost:3000/api/health`; confirm `status` is `ok` and `backendConnected` is `true`.
3. Register a new patient with valid data; confirm the network request is `POST /api/patients` and the response contains a real backend `id`.
4. For Fertility Consultation, confirm a second `POST /api/patients` creates the partner record.
5. Book a valid future appointment; confirm `POST /api/appointments` returns the real appointment record and the confirmation screen appears.
6. Copy the returned patient UUID, reset the flow, use Existing Patient Booking, and confirm `GET /api/patients/:id` loads the patient.
7. Try an appointment with a missing patient ID, invalid UUID, invalid date, end time before start time, and unsupported type; confirm the request is rejected and no confirmation screen appears.
8. Call the backend directly without an authorization header; confirm it returns an unauthorized response. The browser should never call the backend IP directly.
9. Stop or misconfigure the backend; confirm the UI shows an error instead of a fake patient or appointment.
10. Run `npm run lint` and `npm run build` before deployment.

## Project layout

- `src/App.jsx`: registration, lookup, booking, and confirmation flow.
- `src/api.js`: browser-to-server API client and error normalization.
- `src/validation.js`: client-side form validation.
- `src/components/`: date, time, and branding components.
- `server.ts`: Express API proxy, backend authentication, validation, and security middleware.
- `vite.config.ts`: Vite and React configuration.

## Full documentation

See [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md) for the complete architecture, runtime flow, API contract, security model, sample data, manual test cases, expected outcomes, and release acceptance criteria.

