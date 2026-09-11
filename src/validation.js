/**
 * Validation and calculation utilities for Premier Plus Clinic
 */

export function calculateAge(dobString) {
  if (!dobString) return 0;

  // Format: YYYY-MM-DD
  const parts = dobString.split("-");
  if (parts.length !== 3) return 0;

  const birthYear = parseInt(parts[0], 10);
  const birthMonth = parseInt(parts[1], 10) - 1; // 0-indexed
  const birthDay = parseInt(parts[2], 10);

  if (isNaN(birthYear) || isNaN(birthMonth) || isNaN(birthDay)) return 0;

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const currentDay = today.getDate();

  let age = currentYear - birthYear;

  // If birth month/day has not occurred yet this year, decrement age
  if (
    currentMonth < birthMonth ||
    (currentMonth === birthMonth && currentDay < birthDay)
  ) {
    age--;
  }

  return age < 0 ? 0 : age;
}

export function getFullName(title, firstName, lastName) {
  const parts = [title, firstName?.trim(), lastName?.trim()].filter(Boolean);
  return parts.join(" ");
}

export function validatePatient(patient) {
  const errors = {};

  if (!patient.title || !patient.title.trim()) {
    errors.title = "Title is required.";
  }

  if (!patient.firstName || !patient.firstName.trim()) {
    errors.firstName = "First name is required.";
  }

  if (!patient.lastName || !patient.lastName.trim()) {
    errors.lastName = "Last name is required.";
  }

  if (!patient.dateOfBirth) {
    errors.dateOfBirth = "Date of birth is required.";
  } else {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (patient.dateOfBirth > todayStr) {
      errors.dateOfBirth = "Date of birth cannot be in the future.";
    }
  }

  if (!patient.gender) {
    errors.gender = "Gender is required.";
  }

  let phone = (patient.phone || "").trim().replace(/\D/g, "");
  if (phone.length === 12 && phone.startsWith("91")) {
    phone = phone.slice(2);
  }
  if (!phone) {
    errors.phone = "Phone number is required.";
  } else if (!/^[6-9][0-9]{9}$/.test(phone)) {
    errors.phone = "Enter a valid 10-digit mobile number starting with 6-9.";
  }

  if (!patient.branch || !patient.branch.trim()) {
    errors.branch = "Branch is required.";
  }

  if (!patient.purpose || !patient.purpose.trim()) {
    errors.purpose = "Purpose of visit is required.";
  }

  if (!patient.referralSource || !patient.referralSource.trim()) {
    errors.referralSource = "Referral source is required.";
  }

  // Validate partner details if Fertility Consultation (Couple Registration)
  if (patient.purpose === "Fertility Consultation") {
    if (!patient.partnerFirstName || !patient.partnerFirstName.trim()) {
      errors.partnerFirstName = "Partner first name is required for fertility consultation.";
    }
    if (!patient.partnerLastName || !patient.partnerLastName.trim()) {
      errors.partnerLastName = "Partner last name is required for fertility consultation.";
    }
    if (!patient.partnerDateOfBirth) {
      errors.partnerDateOfBirth = "Partner date of birth is required.";
    }
    const partnerPhone = (patient.partnerPhone || "").replace(/\D/g, "");
    if (!partnerPhone) {
      errors.partnerPhone = "Partner phone is required because each patient must have a unique phone number.";
    } else if (!/^[6-9][0-9]{9}$/.test(partnerPhone)) {
      errors.partnerPhone = "Enter a valid partner 10-digit mobile number starting with 6-9.";
    } else if (partnerPhone === phone) {
      errors.partnerPhone = "Partner phone must be different from the primary patient phone.";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateAppointment(appointment) {
  const errors = {};
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  if (!appointment.appointmentDate) {
    errors.appointmentDate = "Appointment date is required.";
  } else if (appointment.appointmentDate < todayStr) {
    errors.appointmentDate = "Appointment date cannot be in the past.";
  }

  if (!appointment.startTime) {
    errors.startTime = "Start time is required.";
  } else if (appointment.appointmentDate === todayStr) {
    const currentHour = today.getHours();
    const currentMinute = today.getMinutes();
    const currentHM = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;
    if (appointment.startTime < currentHM) {
      errors.startTime = "Start time cannot be in the past for today's appointment.";
    }
  }

  if (!appointment.endTime) {
    errors.endTime = "End time is required.";
  }

  if (appointment.startTime && appointment.endTime) {
    // Both are in "HH:MM" 24-hour format
    if (appointment.startTime >= appointment.endTime) {
      errors.endTime = "End time must be later than start time.";
    }
    const [startHour, startMinute] = appointment.startTime.split(":").map(Number);
    const [endHour, endMinute] = appointment.endTime.split(":").map(Number);
    const duration = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
    if (duration !== 15) {
      errors.endTime = "Appointments must be exactly 15 minutes.";
    }
    const startMinutes = startHour * 60 + startMinute;
    if (startMinutes >= 11 * 60 + 30 && startMinutes < 12 * 60 + 30) {
      errors.startTime = "The doctor is unavailable during lunch from 11:30 AM to 12:30 PM.";
    }
  }

  if (!appointment.type) {
    errors.type = "Appointment type is required.";
  }

  if (!appointment.reason || !appointment.reason.trim()) {
    errors.reason = "Reason for appointment is required.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
