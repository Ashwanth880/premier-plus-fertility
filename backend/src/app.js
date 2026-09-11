import express from "express";
import { randomUUID } from "node:crypto";
import { createMysqlStore } from "./mysql-store.js";
import { hashPassword, verifyPassword } from "./password.js";
import { createToken, verifyToken } from "./token.js";
import { validateAppointment, validatePatient } from "./validation.js";
import { generateSlots, isAtLeastMinutesBefore, validateScheduleWindow } from "./scheduling.js";
import { isValidDate } from "./validation.js";

function errorResponse(message, code = "VALIDATION_ERROR") {
  return { error: { code, message } };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function idempotentRoute(req, res, store, operation, handler) {
  const key = String(req.get("Idempotency-Key") || "").trim();
  if (!key || key.length > 128) return res.status(400).json(errorResponse("A valid Idempotency-Key header is required.", "IDEMPOTENCY_KEY_REQUIRED"));
  const claim = await store.claimIdempotency(operation, key, req.body);
  if (!claim.claimed) {
    if (claim.existing.response_status === 0) return res.status(409).json(errorResponse("This request is already being processed.", "IDEMPOTENCY_IN_PROGRESS"));
    return res.status(claim.existing.response_status).json(claim.existing.response_body);
  }
  try {
    const result = await handler();
    await store.completeIdempotency(operation, key, result.status, result.body);
    return res.status(result.status).json(result.body);
  } catch (error) {
    await store.releaseIdempotency(operation, key);
    throw error;
  }
}

function createRateLimiter(limit, windowMs) {
  const entries = new Map();
  return (req, res, next) => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const entry = entries.get(key);
    if (!entry || entry.resetAt <= now) {
      entries.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= limit) return res.status(429).json(errorResponse("Too many requests.", "RATE_LIMITED"));
    entry.count += 1;
    return next();
  };
}

function addSecurityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none';");
  next();
}

function addCors(origin) {
  return (req, res, next) => {
    const requestOrigin = req.headers.origin;
    if (requestOrigin && (origin === "*" || requestOrigin === origin)) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return res.sendStatus(204);
    }
    return next();
  };
}

function requireAuth({ tokenSecret }) {
  return (req, res, next) => {
    const authorization = req.headers.authorization || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const user = verifyToken(token, tokenSecret);
    if (!user) return res.status(401).json(errorResponse("Missing or invalid authorization header", "UNAUTHORIZED"));
    req.user = user;
    return next();
  };
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) return res.status(403).json(errorResponse("Administrator permission is required.", "FORBIDDEN"));
    return next();
  };
}

function normalizePatient(body, id, now) {
  return {
    id,
    patient_id: body.patient_id || `PF${Math.floor(10000 + Math.random() * 90000)}`,
    title: body.title || "Mr",
    first_name: body.first_name.trim(),
    last_name: body.last_name.trim(),
    full_name: body.full_name || `${body.title || ""} ${body.first_name} ${body.last_name}`.trim(),
    age: Number(body.age) || 0,
    branch: body.branch.trim(),
    date_of_birth: body.date_of_birth,
    gender: body.gender.trim(),
    phone: body.phone.replace(/\s+/g, ""),
    purpose: body.purpose.trim(),
    referral_source: body.referral_source || "Unknown",
    created_at: now,
  };
}

export function createApp(config) {
  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }
  if (!config.databasePool) {
    throw new Error("A MySQL database pool is required.");
  }
  const app = express();
  const store = createMysqlStore(config.databasePool);
  const auth = requireAuth({ tokenSecret: config.jwtSecret });
  const admin = [auth, requireRole("admin")];
  const metrics = { requests: 0, errors: 0, conflicts: 0 };

  app.disable("x-powered-by");
  app.use(addSecurityHeaders);
  app.use(addCors(config.corsOrigin));
  app.use(express.json({ limit: "32kb" }));
  app.use("/api", createRateLimiter(120, 60_000));
  app.use((req, res, next) => {
    metrics.requests += 1;
    res.on("finish", () => {
      if (res.statusCode >= 400) metrics.errors += 1;
      if (res.statusCode === 409) metrics.conflicts += 1;
    });
    next();
  });

  app.get("/api/health", asyncRoute(async (_req, res) => {
    if (store.health) await store.health();
    res.json({ status: "ok", service: "premier-plus-fertility-backend", database: "ok" });
  }));

  app.get("/api/health/live", (_req, res) => res.json({ status: "alive" }));

  app.get("/api/metrics", [auth, (_req, res) => res.json({ ...metrics })]);

  app.get("/api/availability", asyncRoute(async (req, res) => {
    const branch = req.query.branch || "Kodambakkam";
    const date = req.query.date;
    if (!date) return res.status(400).json(errorResponse("date is required.", "DATE_REQUIRED"));
    const available = await store.availableSlots(branch, date, config.schedule);
    if (!available) return res.status(404).json(errorResponse("Branch not found.", "BRANCH_NOT_FOUND"));
    const slots = generateSlots(config.schedule).filter((slot) => !available.bookedStarts.has(slot.start_time));
    res.json({ data: { branch: available.branch.name, date, slot_minutes: config.schedule.slotMinutes, lunch: { start: config.schedule.lunchStart, end: config.schedule.lunchEnd }, slots } });
  }));

  app.get("/api/health/ready", asyncRoute(async (_req, res) => {
    if (store.health) await store.health();
    res.json({ status: "ready", database: "ok" });
  }));

  app.post("/api/auth/login", asyncRoute(async (req, res) => {
    const user = await store.findUserByEmail(req.body?.email);
    if (!user || !user.is_active || !verifyPassword(req.body?.password || "", user.password_hash)) {
      return res.status(401).json(errorResponse("Invalid email or password.", "UNAUTHORIZED"));
    }
    const accessToken = createToken({ sub: user.id, email: user.email, role: user.role }, config.jwtSecret, config.tokenTtlSeconds);
    return res.json({ access_token: accessToken, token_type: "bearer", expires_in: config.tokenTtlSeconds });
  }));

  app.post("/api/admin/users", [...admin, asyncRoute(async (req, res) => {
    const { email, password, full_name, role = "staff" } = req.body || {};
    if (!email || !full_name || !password || password.length < 12 || !["admin", "staff"].includes(role)) {
      return res.status(400).json(errorResponse("email, full_name, role, and a password of at least 12 characters are required."));
    }
    if (await store.findUserByEmail(email)) return res.status(409).json(errorResponse("An account with that email already exists.", "DUPLICATE_USER"));
    const user = await store.upsertUser({ id: randomUUID(), email, password_hash: hashPassword(password), full_name, role, is_active: true, created_at: new Date() });
    return res.status(201).json({ data: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, is_active: user.is_active } });
  })]);

  // These kiosk routes are intentionally browser-callable. Deploy behind HTTPS and a clinic network/WAF.
  app.post("/api/patients", asyncRoute(async (req, res) => {
    const validationMessage = validatePatient(req.body);
    if (validationMessage) return res.status(400).json(errorResponse(validationMessage));
    return idempotentRoute(req, res, store, "patient.create", async () => ({ status: 201, body: { data: await store.createPatient(req.body) } }));
  }));

  app.get("/api/patients", [auth, asyncRoute(async (_req, res) => res.json({ data: await store.listPatients() }))]);

  app.get("/api/patients/:id", asyncRoute(async (req, res) => {
    const patient = await store.findPatientById(req.params.id);
    if (!patient) return res.status(404).json(errorResponse("Patient not found.", "PATIENT_NOT_FOUND"));
    return res.json({ data: patient });
  }));

  app.post("/api/appointments", asyncRoute(async (req, res) => {
    const validationMessage = validateAppointment(req.body);
    if (validationMessage) return res.status(400).json(errorResponse(validationMessage));
    const scheduleError = validateScheduleWindow(req.body.start_time, req.body.end_time, config.schedule);
    if (scheduleError) return res.status(400).json(errorResponse(scheduleError.message, scheduleError.code));
    return idempotentRoute(req, res, store, "appointment.create", async () => ({ status: 201, body: { data: await store.reserveAppointment(req.body, config.schedule) } }));
  }));

  app.get("/api/appointments", [auth, asyncRoute(async (_req, res) => res.json({ data: await store.listAppointments() }))]);
  app.get("/api/appointments/:id", [auth, asyncRoute(async (req, res) => {
    const appointment = await store.findAppointmentById(req.params.id);
    if (!appointment) return res.status(404).json(errorResponse("Appointment not found.", "APPOINTMENT_NOT_FOUND"));
    return res.json({ data: appointment });
  })]);

  app.post("/api/appointments/:id/cancel", [auth, asyncRoute(async (req, res) => {
    const existing = await store.findAppointmentById(req.params.id);
    if (!existing) return res.status(404).json(errorResponse("Appointment not found.", "APPOINTMENT_NOT_FOUND"));
    if (!isAtLeastMinutesBefore(String(existing.appointment_date).slice(0, 10), String(existing.start_time).slice(0, 5), 60)) {
      return res.status(409).json(errorResponse("Appointments can only be changed at least one hour before the start time.", "APPOINTMENT_CUTOFF"));
    }
    const cancelled = await store.cancelAppointment(req.params.id, req.user.sub);
    return res.json({ data: cancelled });
  })]);

  app.post("/api/appointments/:id/reschedule", [auth, asyncRoute(async (req, res) => {
    const existing = await store.findAppointmentById(req.params.id);
    if (!existing) return res.status(404).json(errorResponse("Appointment not found.", "APPOINTMENT_NOT_FOUND"));
    if (!isAtLeastMinutesBefore(String(existing.appointment_date).slice(0, 10), String(existing.start_time).slice(0, 5), 60)) {
      return res.status(409).json(errorResponse("Appointments can only be changed at least one hour before the start time.", "APPOINTMENT_CUTOFF"));
    }
    if (!isValidDate(req.body?.appointment_date)) return res.status(400).json(errorResponse("appointment_date must be a valid YYYY-MM-DD date."));
    const scheduleError = validateScheduleWindow(req.body?.start_time, req.body?.end_time, config.schedule);
    if (scheduleError) return res.status(400).json(errorResponse(scheduleError.message, scheduleError.code));
    const updated = await store.rescheduleAppointment(req.params.id, { ...req.body, branch: req.body.branch || existing.branch_name }, config.schedule, req.user.sub);
    return res.json({ data: updated });
  })]);

  app.use((_req, res) => res.status(404).json(errorResponse("Route not found.", "NOT_FOUND")));
  app.use((error, _req, res, _next) => {
    if (error.type === "entity.too.large") return res.status(413).json(errorResponse("Request body is too large.", "PAYLOAD_TOO_LARGE"));
    if (error.code === "ER_DUP_ENTRY" && String(error.sqlMessage || error.message).includes("normalized_phone")) {
      return res.status(409).json(errorResponse("A patient with this phone number already exists.", "DUPLICATE_PATIENT"));
    }
    if (error.code === "ER_DUP_ENTRY" && String(error.sqlMessage || error.message).includes("appointment_slot_locks")) {
      return res.status(409).json(errorResponse("This appointment slot is no longer available.", "SLOT_UNAVAILABLE"));
    }
    if (["SLOT_UNAVAILABLE", "IDEMPOTENCY_KEY_REUSE", "IDEMPOTENCY_IN_PROGRESS", "APPOINTMENT_CUTOFF"].includes(error.code)) {
      return res.status(409).json(errorResponse(error.message, error.code));
    }
    if (["BRANCH_NOT_FOUND", "PATIENT_NOT_FOUND"].includes(error.code)) {
      return res.status(404).json(errorResponse(error.message, error.code));
    }
    console.error("Unhandled backend error:", error.message);
    return res.status(500).json(errorResponse("Internal server error.", "INTERNAL_ERROR"));
  });

  return app;
}
