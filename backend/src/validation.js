const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const APPOINTMENT_TYPES = new Set(["consultation", "follow_up", "routine_checkup", "emergency"]);

export function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validatePatient(body) {
  if (!body || typeof body !== "object") return "A JSON patient payload is required.";
  for (const field of ["first_name", "last_name", "date_of_birth", "gender", "phone", "branch", "purpose"]) {
    if (typeof body[field] !== "string" || !body[field].trim()) return `${field} is required.`;
  }
  if (!isValidDate(body.date_of_birth)) return "date_of_birth must be a valid YYYY-MM-DD date.";
  if (!/^[6-9]\d{9}$/.test(body.phone.replace(/\D/g, ""))) return "phone must be a valid 10-digit mobile number.";
  return null;
}

export function validateAppointment(body) {
  if (!body || typeof body !== "object") return "A JSON appointment payload is required.";
  if (typeof body.patient_id !== "string" || !UUID_PATTERN.test(body.patient_id)) return "patient_id must be a valid patient UUID.";
  if (!isValidDate(body.appointment_date)) return "appointment_date must be a valid YYYY-MM-DD date.";
  if (!TIME_PATTERN.test(body.start_time || "")) return "start_time must use HH:MM format.";
  if (!TIME_PATTERN.test(body.end_time || "")) return "end_time must use HH:MM format.";
  if (body.end_time <= body.start_time) return "end_time must be later than start_time.";
  if (!APPOINTMENT_TYPES.has(body.type)) return "type is not a supported appointment type.";
  if (typeof body.reason !== "string" || !body.reason.trim()) return "reason is required.";
  return null;
}
