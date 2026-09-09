const API_BASE_URL = import.meta.env.VITE_BACKEND_API_URL || (import.meta.env.DEV ? "/api" : "http://13.204.230.143/api");

export { API_BASE_URL };

export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    return await res.json();
  } catch {
    return { status: "unknown" };
  }
}

export async function createPatient(payload) {
  try {
    const response = await fetch(`${API_BASE_URL}/patients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg =
        (typeof result?.error === "object" ? result?.error?.message : result?.error) ||
        result?.message ||
        `Registration failed with HTTP ${response.status}: ${response.statusText}`;
      const err = new Error(errorMsg);
      err.status = response.status;
      err.raw = result;
      throw err;
    }

    return result;
  } catch (err) {
    if (err.name === "TypeError" && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError"))) {
      const networkErr = new Error(
        "Network Error: Unable to reach the server. Please check your connection and retry."
      );
      networkErr.original = err;
      throw networkErr;
    }
    throw err;
  }
}

export async function createAppointment(payload) {
  try {
    const response = await fetch(`${API_BASE_URL}/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg =
        (typeof result?.error === "object" ? result?.error?.message : result?.error) ||
        result?.message ||
        `Appointment booking failed with HTTP ${response.status}: ${response.statusText}`;
      const err = new Error(errorMsg);
      err.status = response.status;
      err.raw = result;
      throw err;
    }

    return result;
  } catch (err) {
    if (err.name === "TypeError" && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError"))) {
      const networkErr = new Error(
        "Network Error: Unable to reach the server. Please check your connection and retry."
      );
      networkErr.original = err;
      throw networkErr;
    }
    throw err;
  }
}
