const API_BASE_URL = "/api";

export { API_BASE_URL };

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    const networkError = new Error(
      "The application server could not be reached. Check that the server is running."
    );
    networkError.isNetworkError = true;
    networkError.cause = error;
    throw networkError;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `Request failed with status ${response.status}.`;
    const apiError = new Error(message);
    apiError.status = response.status;
    apiError.raw = data;
    throw apiError;
  }

  return data;
}

export function checkBackendHealth() {
  return request("/health");
}

export async function createPatient(payload) {
  return createPatientWithKey(payload, globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
}

export async function createPatientWithKey(payload, idempotencyKey) {
  return request("/patients", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(payload),
  });
}

export async function createAppointment(payload) {
  return createAppointmentWithKey(payload, globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
}

export async function createAppointmentWithKey(payload, idempotencyKey) {
  return request("/appointments", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(payload),
  });
}

export function getPatientById(id) {
  return request(`/patients/${encodeURIComponent(id)}`);
}

export function getAvailability(branch, date) {
  const params = new URLSearchParams({ branch, date });
  return request(`/availability?${params.toString()}`);
}

export function cancelAppointment(id, idempotencyKey) {
  return request(`/appointments/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey || globalThis.crypto?.randomUUID?.() || `${Date.now()}-cancel` },
    body: JSON.stringify({}),
  });
}

export function rescheduleAppointment(id, payload, idempotencyKey) {
  return request(`/appointments/${encodeURIComponent(id)}/reschedule`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey || globalThis.crypto?.randomUUID?.() || `${Date.now()}-reschedule` },
    body: JSON.stringify(payload),
  });
}
