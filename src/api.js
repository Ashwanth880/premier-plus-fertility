// Pure frontend client-side API layer (no remote backend network dependency required)
const API_BASE_URL = "/api";

export { API_BASE_URL };

export async function checkBackendHealth() {
  return { status: "online", mock: true };
}

// Client-side local storage helpers to persist registered patients & appointments
function getLocalPatients() {
  try {
    return JSON.parse(localStorage.getItem("premier_patients") || "[]");
  } catch {
    return [];
  }
}

function saveLocalPatient(patient) {
  try {
    const stored = getLocalPatients();
    stored.push(patient);
    localStorage.setItem("premier_patients", JSON.stringify(stored));
  } catch (e) {
    console.warn("LocalStorage save error:", e);
  }
}

function getLocalAppointments() {
  try {
    return JSON.parse(localStorage.getItem("premier_appointments") || "[]");
  } catch {
    return [];
  }
}

function saveLocalAppointment(appointment) {
  try {
    const stored = getLocalAppointments();
    stored.push(appointment);
    localStorage.setItem("premier_appointments", JSON.stringify(stored));
  } catch (e) {
    console.warn("LocalStorage save error:", e);
  }
}

export async function createPatient(payload) {
  // Instant frontend patient creation
  const patientRecord = {
    id: "patient-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
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
    _frontend: true,
  };

  saveLocalPatient(patientRecord);
  return { data: patientRecord };
}

export async function createAppointment(payload) {
  // Instant frontend appointment creation
  const appointmentRecord = {
    id: "appt-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
    patient_id: payload.patient_id,
    doctor_name: "Dr. Premier Fertility Specialist",
    department: "Fertility & Reproductive Medicine",
    appointment_date: payload.appointment_date,
    appointment_time: payload.start_time ? `${payload.start_time} - ${payload.end_time || ""}` : "10:00 AM",
    start_time: payload.start_time,
    end_time: payload.end_time,
    type: payload.type || "In-Person Consultation",
    reason: payload.reason || "General Consultation",
    branch: payload.branch || "Kodambakkam",
    status: "scheduled",
    created_at: new Date().toISOString(),
    _frontend: true,
  };

  saveLocalAppointment(appointmentRecord);
  return { data: appointmentRecord };
}

export async function getPatientById(id) {
  const patients = getLocalPatients();
  const found = patients.find((p) => p.id === id || p.patient_id === id);
  if (found) {
    return { data: found };
  }
  return {
    data: {
      id: id,
      patient_id: id.startsWith("PF") ? id : "PF" + id.slice(0, 5),
      full_name: "Patient " + id.slice(0, 6),
      branch: "Kodambakkam",
      phone: "9876543210",
      created_at: new Date().toISOString(),
    },
  };
}
