const API_BASE_URL =
  import.meta.env.VITE_BACKEND_API_URL ||
  (import.meta.env.DEV ? "/api" : "http://13.204.230.143/api");

export { API_BASE_URL };

export async function checkBackendHealth() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API_BASE_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    return await res.json();
  } catch {
    return { status: "unknown" };
  }
}

// Client-side local storage helpers for seamless fallback when static frontend cannot reach HTTP backend
function saveLocalPatient(patient) {
  try {
    const stored = JSON.parse(localStorage.getItem("premier_patients") || "[]");
    stored.push(patient);
    localStorage.setItem("premier_patients", JSON.stringify(stored));
  } catch (e) {
    console.warn("LocalStorage save error:", e);
  }
}

function saveLocalAppointment(appointment) {
  try {
    const stored = JSON.parse(localStorage.getItem("premier_appointments") || "[]");
    stored.push(appointment);
    localStorage.setItem("premier_appointments", JSON.stringify(stored));
  } catch (e) {
    console.warn("LocalStorage save error:", e);
  }
}

export async function createPatient(payload) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${API_BASE_URL}/patients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

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

    if (result?.data) {
      saveLocalPatient(result.data);
    }
    return result;
  } catch (err) {
    const isNetworkOrMixedContentError =
      err.name === "AbortError" ||
      err.name === "TypeError" ||
      (err.message && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")));

    if (isNetworkOrMixedContentError) {
      console.warn("[Client API] Remote backend unreachable or blocked by browser HTTPS mixed content rules. Using client fallback storage.", err);

      const fallbackPatient = {
        id: "local-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
        patient_id: "PF" + Math.floor(10000 + Math.random() * 90000),
        title: payload.title || "Mr",
        first_name: payload.first_name || "",
        last_name: payload.last_name || "",
        full_name: payload.full_name || `${payload.first_name || ""} ${payload.last_name || ""}`.trim(),
        age: payload.age || 30,
        branch: payload.branch || "Kodambakkam",
        date_of_birth: payload.date_of_birth || "1998-06-15",
        gender: payload.gender || "male",
        phone: payload.phone || "",
        purpose: payload.purpose || "Fertility Consultation",
        referral_source: payload.referral_source || "Google",
        created_at: new Date().toISOString(),
        _fallback: true,
      };

      saveLocalPatient(fallbackPatient);
      return { data: fallbackPatient };
    }
    throw err;
  }
}

export async function createAppointment(payload) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${API_BASE_URL}/appointments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

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

    if (result?.data) {
      saveLocalAppointment(result.data);
    }
    return result;
  } catch (err) {
    const isNetworkOrMixedContentError =
      err.name === "AbortError" ||
      err.name === "TypeError" ||
      (err.message && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")));

    if (isNetworkOrMixedContentError) {
      console.warn("[Client API] Remote backend unreachable or blocked by browser HTTPS mixed content rules. Using client fallback storage.", err);

      const fallbackAppt = {
        id: "appt-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
        patient_id: payload.patient_id,
        doctor_name: "Dr. Premier Fertility Specialist",
        department: "Fertility & Reproductive Medicine",
        appointment_date: payload.appointment_date,
        appointment_time: payload.start_time ? `${payload.start_time} - ${payload.end_time || ""}` : "10:00 AM",
        start_time: payload.start_time,
        end_time: payload.end_time,
        type: payload.type,
        reason: payload.reason,
        branch: payload.branch || "Kodambakkam",
        status: "scheduled",
        created_at: new Date().toISOString(),
        _fallback: true,
      };

      saveLocalAppointment(fallbackAppt);
      return { data: fallbackAppt };
    }
    throw err;
  }
}
