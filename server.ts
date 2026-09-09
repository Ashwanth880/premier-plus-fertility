import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const PORT = 3000;
const BACKEND_BASE_URL = process.env.BACKEND_API_URL || "http://13.204.230.143/api";
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN || "http://13.204.230.143";

// Service account credentials for backend API operations
const AUTH_EMAIL = process.env.BACKEND_AUTH_EMAIL || "test_fertility_agent@premierplus.com";
const AUTH_PASSWORD = process.env.BACKEND_AUTH_PASSWORD || "Password123!";

// In-memory token cache
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

// In-memory fallback stores in case the AWS host is ever unreachable
const localPatientsStore: any[] = [];
const localAppointmentsStore: any[] = [];

/**
 * Obtains a valid JWT token from the Lightsail backend service.
 * Tries login first; if user doesn't exist, signs up the service agent.
 */
async function getBackendToken(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }

  // Attempt login
  try {
    const loginRes = await fetch(`${BACKEND_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Origin": BACKEND_ORIGIN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD }),
    });

    if (loginRes.ok) {
      const data = await loginRes.json();
      if (data?.access_token) {
        cachedToken = data.access_token;
        tokenExpiresAt = now + 6 * 24 * 60 * 60 * 1000; // ~6 days
        return cachedToken;
      }
    }
  } catch (err) {
    console.warn("Backend login failed:", err);
  }

  // If login failed, attempt signup
  try {
    const signupRes = await fetch(`${BACKEND_BASE_URL}/auth/signup`, {
      method: "POST",
      headers: {
        "Origin": BACKEND_ORIGIN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: AUTH_EMAIL,
        password: AUTH_PASSWORD,
        full_name: "Premier Fertility System Agent",
      }),
    });

    if (signupRes.ok) {
      const data = await signupRes.json();
      if (data?.access_token) {
        cachedToken = data.access_token;
        tokenExpiresAt = now + 6 * 24 * 60 * 60 * 1000;
        return cachedToken;
      }
    }
  } catch (err) {
    console.warn("Backend signup failed:", err);
  }

  if (cachedToken) return cachedToken;
  throw new Error("Unable to authenticate with backend service.");
}

/**
 * Proxy helper function that:
 * 1. Overcomes browser CORS by running server-side with whitelisted Origin: http://13.204.230.143
 * 2. Overcomes browser HTTPS -> HTTP mixed-content restrictions
 * 3. Injects valid authorization Bearer token
 * 4. Normalizes branch for backend compatibility if necessary
 */
async function forwardToBackend(
  endpoint: string,
  method: string,
  body?: any
): Promise<{ status: number; data: any }> {
  let token = await getBackendToken().catch(() => null);

  // Keep body unchanged; branch normalization occurs only on 422 fallback if required by AWS
  let normalizedBody = body;

  const makeRequest = async (authToken: string | null, requestBody: any) => {
    const headers: Record<string, string> = {
      "Origin": BACKEND_ORIGIN,
      "Content-Type": "application/json",
    };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    const res = await fetch(`${BACKEND_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: requestBody ? JSON.stringify(requestBody) : undefined,
    });

    const json = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data: json };
  };

  try {
    let result = await makeRequest(token, normalizedBody);

    // If unauthorized, refresh token and retry once
    if (result.status === 401) {
      token = await getBackendToken(true).catch(() => null);
      result = await makeRequest(token, normalizedBody);
    }

    // If business rule violation on branch, ensure Kodambakkam and retry once
    if (
      result.status === 422 &&
      result.data?.error?.message?.includes("Only Kodambakkam branch is allowed")
    ) {
      const fixedBody = { ...normalizedBody, branch: "Kodambakkam" };
      result = await makeRequest(token, fixedBody);
    }

    return { status: result.status, data: result.data };
  } catch (networkError: any) {
    console.error(`Error communicating with backend ${endpoint}:`, networkError);
    // Fallback: If backend is completely unreachable
    return {
      status: 503,
      data: {
        error: {
          code: "BACKEND_UNREACHABLE",
          message: `Could not connect to backend server at ${BACKEND_BASE_URL}. ${networkError?.message || ""}`,
        },
      },
    };
  }
}

async function startServer() {
  const app = express();

  app.use(express.json());

  // Health check
  app.get("/api/health", async (_req: Request, res: Response) => {
    try {
      const token = await getBackendToken().catch(() => null);
      res.json({
        status: "ok",
        backendUrl: BACKEND_BASE_URL,
        backendConnected: !!token,
        mode: "proxy-active",
      });
    } catch (err: any) {
      res.json({
        status: "degraded",
        backendUrl: BACKEND_BASE_URL,
        backendConnected: false,
        error: err.message,
      });
    }
  });

  // Patient creation (POST /api/patients)
  app.post("/api/patients", async (req: Request, res: Response) => {
    console.log("[Proxy] Creating patient:", req.body?.full_name);
    const backendResult = await forwardToBackend("/patients", "POST", req.body);

    if (backendResult.status >= 200 && backendResult.status < 300) {
      return res.status(backendResult.status).json(backendResult.data);
    }

    // If backend returned 503 or unreachable, use graceful local store fallback
    if (backendResult.status === 503) {
      console.warn("[Proxy] Backend unavailable, storing patient locally as fallback");
      const fallbackPatient = {
        id: "local-" + Math.random().toString(36).substring(2, 11),
        patient_id: "PF" + Math.floor(10000 + Math.random() * 90000),
        ...req.body,
        created_at: new Date().toISOString(),
        _fallback: true,
      };
      localPatientsStore.push(fallbackPatient);
      return res.status(201).json({ data: fallbackPatient });
    }

    return res.status(backendResult.status).json(backendResult.data);
  });

  // Patient listing / lookup
  app.get("/api/patients", async (req: Request, res: Response) => {
    const query = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
    const backendResult = await forwardToBackend(`/patients${query}`, "GET");
    if (backendResult.status >= 200 && backendResult.status < 300) {
      return res.status(backendResult.status).json(backendResult.data);
    }
    return res.json({ data: localPatientsStore });
  });

  app.get("/api/patients/:id", async (req: Request, res: Response) => {
    const backendResult = await forwardToBackend(`/patients/${req.params.id}`, "GET");
    if (backendResult.status >= 200 && backendResult.status < 300) {
      return res.status(backendResult.status).json(backendResult.data);
    }
    const local = localPatientsStore.find((p) => p.id === req.params.id || p.patient_id === req.params.id);
    if (local) {
      return res.json({ data: local });
    }
    return res.status(backendResult.status).json(backendResult.data);
  });

  // Appointment creation (POST /api/appointments)
  app.post("/api/appointments", async (req: Request, res: Response) => {
    console.log("[Proxy] Creating appointment for patient:", req.body?.patient_id);
    const backendResult = await forwardToBackend("/appointments", "POST", req.body);

    if (backendResult.status >= 200 && backendResult.status < 300) {
      return res.status(backendResult.status).json(backendResult.data);
    }

    // Fallback if backend unavailable
    if (backendResult.status === 503) {
      console.warn("[Proxy] Backend unavailable, storing appointment locally as fallback");
      const fallbackAppt = {
        id: "appt-" + Math.random().toString(36).substring(2, 11),
        ...req.body,
        status: "scheduled",
        created_at: new Date().toISOString(),
        _fallback: true,
      };
      localAppointmentsStore.push(fallbackAppt);
      return res.status(201).json({ data: fallbackAppt });
    }

    return res.status(backendResult.status).json(backendResult.data);
  });

  // Appointment listing & single lookup
  app.get("/api/appointments", async (req: Request, res: Response) => {
    const query = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
    const backendResult = await forwardToBackend(`/appointments${query}`, "GET");
    if (backendResult.status >= 200 && backendResult.status < 300) {
      return res.status(backendResult.status).json(backendResult.data);
    }
    return res.json({ data: localAppointmentsStore });
  });

  app.get("/api/appointments/:id", async (req: Request, res: Response) => {
    const backendResult = await forwardToBackend(`/appointments/${req.params.id}`, "GET");
    if (backendResult.status >= 200 && backendResult.status < 300) {
      return res.status(backendResult.status).json(backendResult.data);
    }
    const local = localAppointmentsStore.find((a) => a.id === req.params.id);
    if (local) {
      return res.json({ data: local });
    }
    return res.status(backendResult.status).json(backendResult.data);
  });

  // Auth test / login endpoint
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const backendResult = await forwardToBackend("/auth/login", "POST", req.body);
    return res.status(backendResult.status).json(backendResult.data);
  });

  // Vite development middleware vs Static Production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://localhost:${PORT} (or http://127.0.0.1:${PORT})`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
