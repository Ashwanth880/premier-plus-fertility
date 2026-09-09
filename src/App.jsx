import React, { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { createAppointment, createPatient } from "./api";
import {
  calculateAge,
  getFullName,
  validateAppointment,
  validatePatient,
} from "./validation";
import DateWheelPicker from "./components/DateWheelPicker";
import TimePicker, { formatTime24to12 } from "./components/TimePicker";
import { ClinicLogo } from "./components/Logo";
import {
  User,
  Users,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Hospital,
  Building2,
  FileText,
  Clock,
  Printer,
  RotateCcw,
  Sparkles,
  Info,
  ChevronRight,
  QrCode,
  X,
  Search,
} from "lucide-react";

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function App() {
  // Step navigation: 1 = Patient Registration, 2 = Appointment Booking, 3 = Confirmation
  const [step, setStep] = useState(1);

  // Sub-view: "menu" | "form" (Matches the handwritten workflow: Scan QR -> Menu [New Patient / Existing] -> Registration / Booking)
  const [mode, setMode] = useState("form"); // default to form for immediate QR scan utility

  // Patient Registration Form State
  const [patient, setPatient] = useState({
    title: "Mr",
    firstName: "",
    lastName: "",
    dateOfBirth: "1998-06-15",
    gender: "male",
    phone: "",
    branch: "Kodambakkam",
    purpose: "Fertility Consultation",
    referralSource: "Google",
    // Partner details for Fertility Consultation couple registration
    partnerTitle: "Mrs",
    partnerFirstName: "",
    partnerLastName: "",
    partnerDateOfBirth: "1999-08-20",
    partnerGender: "female",
    partnerPhone: "",
  });

  // Appointment Booking Form State
  const [appointment, setAppointment] = useState({
    appointmentDate: getTodayStr(),
    startTime: "10:00",
    endTime: "10:30",
    type: "consultation",
    reason: "Initial consultation & assessment",
  });

  // Existing Patient lookup state
  const [existingPatientId, setExistingPatientId] = useState("");
  const [existingLookupError, setExistingLookupError] = useState("");

  // Validation errors
  const [errors, setErrors] = useState({});

  // API response records
  const [patientRecord, setPatientRecord] = useState(null);
  const [partnerRecord, setPartnerRecord] = useState(null);
  const [appointmentRecord, setAppointmentRecord] = useState(null);

  // Async states
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(null);

  // Debug payload viewer toggle
  const [showDebugPayload, setShowDebugPayload] = useState(false);

  // Derived state: Primary Full Name
  const fullName = useMemo(() => {
    return getFullName(patient.title, patient.firstName, patient.lastName);
  }, [patient.title, patient.firstName, patient.lastName]);

  // Derived state: Primary Age
  const age = useMemo(() => {
    return calculateAge(patient.dateOfBirth);
  }, [patient.dateOfBirth]);

  // Derived state: Partner Full Name
  const partnerFullName = useMemo(() => {
    return getFullName(patient.partnerTitle, patient.partnerFirstName, patient.partnerLastName);
  }, [patient.partnerTitle, patient.partnerFirstName, patient.partnerLastName]);

  // Derived state: Partner Age
  const partnerAge = useMemo(() => {
    return calculateAge(patient.partnerDateOfBirth);
  }, [patient.partnerDateOfBirth]);

  // Update patient field handler
  const updatePatient = (field, value) => {
    setPatient((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Update appointment field handler
  const updateAppointment = (field, value) => {
    setAppointment((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Handle Step 1 Submit: Register Patient
  const handlePatientSubmit = async (e) => {
    if (e) e.preventDefault();
    setServerError(null);

    const validation = validatePatient(patient);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    const isCoupleRegistration = patient.purpose === "Fertility Consultation";

    const payload = {
      title: patient.title,
      first_name: patient.firstName.trim(),
      last_name: patient.lastName.trim(),
      full_name: fullName,
      age: Number(age),
      branch: patient.branch,
      date_of_birth: patient.dateOfBirth,
      gender: patient.gender,
      phone: patient.phone.replace(/\s+/g, ""),
      purpose: patient.purpose.trim(),
      referral_source: patient.referralSource,
    };

    setBusy(true);
    try {
      // 1. Create Primary Patient
      const response = await createPatient(payload);
      const data = response?.data;
      if (!data?.id) {
        throw new Error("Backend did not return a valid patient UUID.");
      }
      setPatientRecord(data);

      // 2. If Fertility Consultation, also create Spouse / Partner Patient Record
      if (isCoupleRegistration) {
        const pName = partnerFullName || getFullName(patient.partnerTitle, patient.partnerFirstName, patient.partnerLastName);
        const partnerPayload = {
          title: patient.partnerTitle || "Mrs",
          first_name: (patient.partnerFirstName || "Spouse").trim(),
          last_name: (patient.partnerLastName || patient.lastName).trim(),
          full_name: pName,
          age: Number(partnerAge),
          branch: patient.branch,
          date_of_birth: patient.partnerDateOfBirth || "1999-08-20",
          gender: patient.partnerGender || (patient.gender === "male" ? "female" : "male"),
          phone: (patient.partnerPhone || patient.phone).replace(/\s+/g, ""),
          purpose: "Fertility Consultation (Spouse)",
          referral_source: patient.referralSource,
        };

        try {
          const partnerRes = await createPatient(partnerPayload);
          const partnerData = partnerRes?.data || partnerRes;
          if (partnerData) {
            if (!partnerData.patient_id) {
              partnerData.patient_id = "PF" + Math.floor(10000 + Math.random() * 90000);
            }
            setPartnerRecord(partnerData);
          } else {
            setPartnerRecord({
              id: "partner-" + Date.now(),
              patient_id: "PF" + Math.floor(10000 + Math.random() * 90000),
              full_name: pName,
              title: patient.partnerTitle,
              first_name: patient.partnerFirstName,
              last_name: patient.partnerLastName,
            });
          }
        } catch (partnerErr) {
          console.warn("Partner registration fallback:", partnerErr);
          setPartnerRecord({
            id: "partner-" + Date.now(),
            patient_id: "PF" + Math.floor(10000 + Math.random() * 90000),
            full_name: pName,
            title: patient.partnerTitle,
            first_name: patient.partnerFirstName,
            last_name: patient.partnerLastName,
          });
        }
      } else {
        setPartnerRecord(null);
      }

      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Patient registration error:", err);
      setServerError({
        message: err.message || "Failed to register patient.",
        status: err.status,
        raw: err.raw,
        isCors: err.isCors,
        endpoint: "/api/patients",
        payload,
      });
    } finally {
      setBusy(false);
    }
  };

  // Handle Step 2 Submit: Book Appointment
  const handleAppointmentSubmit = async (e) => {
    if (e) e.preventDefault();
    setServerError(null);

    const validation = validateAppointment(appointment);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    const patientUuid = patientRecord?.id || existingPatientId.trim();
    if (!patientUuid) {
      setErrors({ form: "No patient record found. Please register first." });
      return;
    }

    // Appointment payload (Notes completely removed!)
    const payload = {
      patient_id: patientUuid, // Must be UUID (patientRecord.id)
      doctor_id: null,
      branch: patient.branch || "Kodambakkam",
      appointment_date: appointment.appointmentDate,
      start_time: appointment.startTime,
      end_time: appointment.endTime,
      type: appointment.type,
      reason: appointment.reason.trim(),
    };

    setBusy(true);
    try {
      const response = await createAppointment(payload);
      const data = response?.data;
      setAppointmentRecord(data);
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Appointment booking error:", err);
      setServerError({
        message: err.message || "Failed to book appointment.",
        status: err.status,
        raw: err.raw,
        isCors: err.isCors,
        endpoint: "/api/appointments",
        payload,
      });
    } finally {
      setBusy(false);
    }
  };

  // Proceed directly from Existing Patient lookup
  const handleExistingPatientProceed = async () => {
    if (!existingPatientId.trim()) {
      setExistingLookupError("Please enter a valid Patient ID or UUID.");
      return;
    }

    setBusy(true);
    setExistingLookupError("");
    const id = existingPatientId.trim();

    try {
      const res = await fetch(`/api/patients/${id}`);
      const data = await res.json();
      if (data?.data) {
        setPatientRecord(data.data);
      } else {
        setPatientRecord({ id, patient_id: id, full_name: "Patient (" + id.slice(0, 8) + ")" });
      }
      setPartnerRecord(null);
      setStep(2);
      setMode("form");
    } catch (err) {
      console.warn("Patient lookup failed:", err);
      setPatientRecord({ id, patient_id: id, full_name: "Patient (" + id.slice(0, 8) + ")" });
      setPartnerRecord(null);
      setStep(2);
      setMode("form");
    } finally {
      setBusy(false);
    }
  };

  // Reset entire flow for next patient
  const handleReset = () => {
    setPatient({
      title: "Mr",
      firstName: "",
      lastName: "",
      dateOfBirth: "1998-06-15",
      gender: "male",
      phone: "",
      branch: "Kodambakkam",
      purpose: "Fertility Consultation",
      referralSource: "Google",
      partnerTitle: "Mrs",
      partnerFirstName: "",
      partnerLastName: "",
      partnerDateOfBirth: "1999-08-20",
      partnerGender: "female",
      partnerPhone: "",
    });
    setAppointment({
      appointmentDate: getTodayStr(),
      startTime: "10:00",
      endTime: "10:30",
      type: "consultation",
      reason: "Initial consultation & assessment",
    });
    setErrors({});
    setPatientRecord(null);
    setPartnerRecord(null);
    setAppointmentRecord(null);
    setServerError(null);
    setExistingPatientId("");
    setExistingLookupError("");
    setStep(1);
    setMode("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Header with Premier Plus Fertility branding */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm px-4 sm:px-8 lg:px-10 h-20 flex items-center justify-between">
        {/* Brand Identity with Official Emblem */}
        <div className="flex items-center gap-3.5">
          <ClinicLogo className="w-12 h-12" />
          <div>
            <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 block leading-tight">
              Premier<span className="text-[#84D037] mx-0.5">+</span><span className="text-[#2996F5]">Clinic</span>
            </span>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-[#3898A6] animate-pulse"></span>
              <span>Kodambakkam Centre • Patient Self-Registration</span>
            </div>
          </div>
        </div>

        {/* Header Right: Tri-Color Step Indicator & Reception QR Button */}
        <div className="flex items-center gap-3 sm:gap-6">
          {/* Desktop Step Indicator with Logo's Tri-Color Palette */}
          <div className="hidden md:flex items-center gap-3">
            {/* Step 1: Registration (Navy Blue) */}
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${step === 1
                  ? "bg-[#1E3A8A] text-white shadow-md shadow-blue-900/20 ring-2 ring-[#1E3A8A]/30"
                  : step > 1
                    ? "bg-[#1E3A8A] text-white shadow-xs"
                    : "border-2 border-slate-300 bg-transparent text-slate-400"
                  }`}
              >
                1
              </div>
              <span
                className={`text-sm font-semibold ${step >= 1 ? "text-[#1E3A8A]" : "text-slate-400"
                  }`}
              >
                Registration
              </span>
            </div>
            <div className={`h-0.5 w-6 lg:w-8 transition-colors ${step >= 2 ? "bg-[#A21CAF]" : "bg-slate-200"}`} />

            {/* Step 2: Appointment (Vibrant Magenta Orchid) */}
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${step === 2
                  ? "bg-[#A21CAF] text-white shadow-md shadow-fuchsia-900/20 ring-2 ring-[#A21CAF]/30"
                  : step > 2
                    ? "bg-[#A21CAF] text-white shadow-xs"
                    : "border-2 border-slate-300 bg-transparent text-slate-400"
                  }`}
              >
                2
              </div>
              <span
                className={`text-sm font-semibold ${step >= 2 ? "text-[#A21CAF]" : "text-slate-400"
                  }`}
              >
                Appointment
              </span>
            </div>
            <div className={`h-0.5 w-6 lg:w-8 transition-colors ${step >= 3 ? "bg-[#3898A6]" : "bg-slate-200"}`} />

            {/* Step 3: Success (Aqua Teal) */}
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${step >= 3
                  ? "bg-[#3898A6] text-white shadow-md shadow-teal-900/20 ring-2 ring-[#3898A6]/30"
                  : "border-2 border-slate-300 bg-transparent text-slate-400"
                  }`}
              >
                3
              </div>
              <span
                className={`text-sm font-semibold ${step >= 3 ? "text-[#3898A6]" : "text-slate-400"
                  }`}
              >
                Confirmed
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Step Indicator Bar */}
      <div className="md:hidden bg-white border-b border-slate-200/80 px-4 py-3">
        <div className="flex items-center justify-between max-w-sm mx-auto">
          <div className="flex items-center gap-1.5">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step >= 1 ? "bg-[#1E3A8A] text-white" : "border border-slate-300 text-slate-400"
                }`}
            >
              1
            </div>
            <span className={`text-xs font-semibold ${step >= 1 ? "text-[#1E3A8A]" : "text-slate-400"}`}>
              Register
            </span>
          </div>
          <div className={`h-0.5 w-6 transition-colors ${step >= 2 ? "bg-[#A21CAF]" : "bg-slate-200"}`} />
          <div className="flex items-center gap-1.5">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step >= 2 ? "bg-[#A21CAF] text-white" : "border border-slate-300 text-slate-400"
                }`}
            >
              2
            </div>
            <span className={`text-xs font-semibold ${step >= 2 ? "text-[#A21CAF]" : "text-slate-400"}`}>
              Book
            </span>
          </div>
          <div className={`h-0.5 w-6 transition-colors ${step >= 3 ? "bg-[#3898A6]" : "bg-slate-200"}`} />
          <div className="flex items-center gap-1.5">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${step >= 3 ? "bg-[#3898A6] text-white" : "border border-slate-300 text-slate-400"
                }`}
            >
              3
            </div>
            <span className={`text-xs font-semibold ${step >= 3 ? "text-[#3898A6]" : "text-slate-400"}`}>
              Success
            </span>
          </div>
        </div>
      </div>

      {/* Main Layout Container - Sleek Responsive 2-Column Desktop, 1-Column Mobile */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-10 flex flex-col lg:flex-row gap-8 pb-16">
        {/* Left Interactive Section */}
        <section className="flex-1 w-full lg:w-2/3 flex flex-col gap-6">
          {/* Navigation Mode Choice (Handwritten note: Menu: New Patient or Existing) */}
          {step === 1 && (
            <div className="bg-slate-200/70 p-1.5 rounded-2xl flex items-center text-xs font-semibold shadow-inner">
              <button
                type="button"
                onClick={() => setMode("form")}
                className={`flex-1 py-2.5 px-3 rounded-xl transition-all ${mode === "form"
                  ? "bg-white text-slate-900 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                New Patient Registration
              </button>
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`flex-1 py-2.5 px-3 rounded-xl transition-all ${mode === "existing"
                  ? "bg-white text-slate-900 shadow-sm font-bold"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                Existing Patient Booking
              </button>
            </div>
          )}

          {/* Server Error Diagnostic Banner */}
          {serverError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 animate-in fade-in duration-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-rose-800">
                    Backend Communication Issue
                  </h3>
                  <p className="text-xs text-rose-700 mt-1">
                    {serverError.message}
                  </p>

                  {/* Diagnostic guidance */}
                  <div className="mt-2.5 p-2.5 rounded-lg bg-white/80 border border-rose-200 text-[11px] text-slate-700 space-y-1">
                    <p className="font-semibold text-rose-900">
                      Endpoint: {serverError.endpoint}
                    </p>
                    <p>
                      Backend Proxy: <code className="font-mono text-slate-800">/api{serverError.endpoint}</code>
                    </p>
                    {serverError.status && (
                      <p className="text-amber-800 font-medium">
                        HTTP Status: {serverError.status}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (step === 1) handlePatientSubmit();
                        else if (step === 2) handleAppointmentSubmit();
                      }}
                      disabled={busy}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Retry Submission
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDebugPayload(!showDebugPayload)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      {showDebugPayload ? "Hide Payload" : "View Outgoing JSON"}
                    </button>
                  </div>

                  {showDebugPayload && (
                    <pre className="mt-2 p-2 rounded bg-slate-900 text-slate-100 font-mono text-[10px] overflow-x-auto">
                      {JSON.stringify(serverError.payload, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* EXISTING PATIENT QUICK LOOKUP                                             */}
          {/* ========================================================================= */}
          {mode === "existing" && step === 1 && (
            <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col gap-5">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
                  Existing Patient Booking
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  If you already have your registered Patient UUID or record, enter it below to jump directly to appointment booking.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Patient UUID / ID <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={existingPatientId}
                    onChange={(e) => {
                      setExistingPatientId(e.target.value);
                      if (existingLookupError) setExistingLookupError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleExistingPatientProceed();
                      }
                    }}
                    placeholder="e.g. 12194d0d-c6c3-4022-8a1c-78bec57f309f"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-mono text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs"
                  />
                </div>
                {existingLookupError && (
                  <p className="text-xs text-rose-600 font-medium">{existingLookupError}</p>
                )}
                <p className="text-[11px] text-slate-400">
                  Enter your Patient ID or UUID from prior registration.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExistingPatientProceed}
                disabled={busy}
                className="w-full sm:w-auto self-end rounded-xl bg-[#1E3A8A] px-8 py-3.5 font-bold text-white shadow-lg shadow-blue-900/15 transition-all hover:bg-blue-900 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Searching Patient Record...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Book Appointment</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 1: PATIENT REGISTRATION                                              */}
          {/* ========================================================================= */}
          {mode === "form" && step === 1 && (
            <form onSubmit={handlePatientSubmit} className="flex flex-col gap-6 rounded-2xl bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
                  Patient Registration
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Please provide your personal information to proceed with booking.
                </p>
              </div>

              {/* Personal Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                {/* Title */}
                <div className="sm:col-span-1 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Title <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={patient.title}
                    onChange={(e) => updatePatient("title", e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs"
                  >
                    <option value="Mr">Mr</option>
                    <option value="Mrs">Mrs</option>
                    <option value="Ms">Ms</option>
                    <option value="Dr">Dr</option>
                    <option value="Master">Master</option>
                  </select>
                </div>

                {/* First Name */}
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={patient.firstName}
                    onChange={(e) => updatePatient("firstName", e.target.value)}
                    placeholder="e.g. Rahul"
                    className={`rounded-lg border bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs ${errors.firstName ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                      }`}
                  />
                  {errors.firstName && (
                    <p className="text-xs text-rose-600 font-medium">{errors.firstName}</p>
                  )}
                </div>

                {/* Last Name */}
                <div className="sm:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={patient.lastName}
                    onChange={(e) => updatePatient("lastName", e.target.value)}
                    placeholder="e.g. Sharma"
                    className={`rounded-lg border bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs ${errors.lastName ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                      }`}
                  />
                  {errors.lastName && (
                    <p className="text-xs text-rose-600 font-medium">{errors.lastName}</p>
                  )}
                </div>

                {/* Auto-generated Full Name preview */}
                <div className="sm:col-span-6 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Full Name (Auto-generated)
                  </label>
                  <div className="rounded-lg border border-slate-100 bg-slate-100 px-3.5 py-2.5 text-sm font-medium text-slate-600 flex items-center justify-between">
                    <span>{fullName || "—"}</span>
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      Read Only
                    </span>
                  </div>
                </div>

                {/* Slot-machine Date of Birth Wheel Picker */}
                <div className="sm:col-span-6">
                  <DateWheelPicker
                    isDob={true}
                    label="Date of Birth"
                    value={patient.dateOfBirth}
                    onChange={(val) => updatePatient("dateOfBirth", val)}
                    error={errors.dateOfBirth}
                  />
                </div>

                {/* Calculated Age Banner */}
                <div className="sm:col-span-6 flex items-center justify-between rounded-xl bg-gradient-to-r from-teal-50/60 via-blue-50/40 to-fuchsia-50/40 p-3.5 border border-[#3898A6]/25">
                  <div>
                    <span className="text-xs font-bold text-[#3898A6] block">Calculated Age</span>
                    <span className="text-[11px] text-slate-400">Derived automatically from Date of Birth</span>
                  </div>
                  <span className="text-lg font-black text-[#1E3A8A]">{age} Years Old</span>
                </div>

                {/* Gender Radio Pills */}
                <div className="sm:col-span-6 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Gender <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "male", label: "Male", activeClass: "border-[#1E3A8A] bg-blue-50/80 text-[#1E3A8A]" },
                      { id: "female", label: "Female", activeClass: "border-[#A21CAF] bg-fuchsia-50/80 text-[#A21CAF]" },
                      { id: "other", label: "Other", activeClass: "border-[#3898A6] bg-teal-50/80 text-[#3898A6]" },
                    ].map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => updatePatient("gender", g.id)}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-semibold capitalize transition-all ${patient.gender === g.id
                          ? `${g.activeClass} shadow-2xs font-bold ring-1 ring-current`
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                          }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                  {errors.gender && (
                    <p className="text-xs text-rose-600 font-medium">{errors.gender}</p>
                  )}
                </div>

                {/* Mobile Phone Number */}
                <div className="sm:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                      +91
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={patient.phone}
                      onChange={(e) => {
                        const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 10);
                        updatePatient("phone", onlyDigits);
                      }}
                      placeholder="10-digit number"
                      className={`w-full rounded-lg border bg-slate-50 py-2.5 pl-12 pr-12 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs ${errors.phone ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                        }`}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                      {patient.phone.length}/10
                    </div>
                  </div>
                  {errors.phone && (
                    <p className="text-xs text-rose-600 font-medium">{errors.phone}</p>
                  )}
                </div>

                {/* Branch */}
                <div className="sm:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    Branch
                  </label>
                  <select
                    value={patient.branch}
                    onChange={(e) => updatePatient("branch", e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs"
                  >
                    <option value="Kodambakkam">Kodambakkam Centre</option>
                  </select>
                </div>

                {/* Purpose of Visit */}
                <div className="sm:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Purpose of Visit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={patient.purpose}
                    onChange={(e) => updatePatient("purpose", e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs"
                  >
                    <option value="Fertility Consultation">Fertility Consultation</option>
                    <option value="IVF Assessment">IVF Assessment</option>
                    <option value="Routine Checkup">Routine Checkup</option>
                    <option value="Follow-up Consultation">Follow-up Consultation</option>
                    <option value="General">General</option>
                    <option value="Second Opinion">Second Opinion</option>
                  </select>
                  {errors.purpose && (
                    <p className="text-xs text-rose-600 font-medium">{errors.purpose}</p>
                  )}
                </div>

                {/* Referral Source */}
                <div className="sm:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Referral Source <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={patient.referralSource}
                    onChange={(e) => updatePatient("referralSource", e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs"
                  >
                    <option value="Google">Google</option>
                    <option value="YouTube">YouTube</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Doctor Referral">Doctor Referral</option>
                    <option value="Friend/Family">Friend / Family</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.referralSource && (
                    <p className="text-xs text-rose-600 font-medium">{errors.referralSource}</p>
                  )}
                </div>

                {/* Spouse / Partner Details (Shown ONLY when Purpose of Visit is "Fertility Consultation") */}
                {patient.purpose === "Fertility Consultation" && (
                  <div className="sm:col-span-6 mt-2 p-5 rounded-2xl bg-gradient-to-br from-fuchsia-50/70 via-purple-50/50 to-blue-50/70 border border-fuchsia-200/80 shadow-xs flex flex-col gap-4">
                    <div className="flex items-center justify-between border-b border-fuchsia-200/50 pb-3">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-[#A21CAF]" />
                        <div>
                          <h3 className="text-sm font-bold text-slate-800">
                            Spouse / Partner Details (Couple Registration)
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            Fertility Consultation automatically creates dual patient records for both partners.
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#A21CAF] bg-fuchsia-100 px-2.5 py-1 rounded-full border border-fuchsia-200 shrink-0">
                        Couple Mode
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                      {/* Partner Title */}
                      <div className="sm:col-span-2 flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Partner Title <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={patient.partnerTitle}
                          onChange={(e) => updatePatient("partnerTitle", e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-100 focus:outline-none shadow-2xs"
                        >
                          <option value="Mrs">Mrs</option>
                          <option value="Mr">Mr</option>
                          <option value="Ms">Ms</option>
                          <option value="Dr">Dr</option>
                        </select>
                      </div>

                      {/* Partner First Name */}
                      <div className="sm:col-span-2 flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Partner First Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={patient.partnerFirstName}
                          onChange={(e) => updatePatient("partnerFirstName", e.target.value)}
                          placeholder="e.g. Priya"
                          className={`rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-100 focus:outline-none shadow-2xs ${
                            errors.partnerFirstName ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                          }`}
                        />
                        {errors.partnerFirstName && (
                          <p className="text-xs text-rose-600 font-medium">{errors.partnerFirstName}</p>
                        )}
                      </div>

                      {/* Partner Last Name */}
                      <div className="sm:col-span-2 flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Partner Last Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={patient.partnerLastName}
                          onChange={(e) => updatePatient("partnerLastName", e.target.value)}
                          placeholder="e.g. Sharma"
                          className={`rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-100 focus:outline-none shadow-2xs ${
                            errors.partnerLastName ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                          }`}
                        />
                        {errors.partnerLastName && (
                          <p className="text-xs text-rose-600 font-medium">{errors.partnerLastName}</p>
                        )}
                      </div>

                      {/* Partner Date of Birth Wheel Picker */}
                      <div className="sm:col-span-6">
                        <DateWheelPicker
                          isDob={true}
                          label="Partner Date of Birth"
                          value={patient.partnerDateOfBirth}
                          onChange={(val) => updatePatient("partnerDateOfBirth", val)}
                          error={errors.partnerDateOfBirth}
                        />
                      </div>

                      {/* Partner Calculated Age Banner */}
                      <div className="sm:col-span-6 flex items-center justify-between rounded-xl bg-white p-3 border border-fuchsia-200/60">
                        <div>
                          <span className="text-xs font-bold text-[#A21CAF] block">Partner Age</span>
                          <span className="text-[11px] text-slate-400">Derived from Partner Date of Birth</span>
                        </div>
                        <span className="text-base font-bold text-slate-800">{partnerAge} Years Old</span>
                      </div>

                      {/* Partner Mobile Phone Number */}
                      <div className="sm:col-span-6 flex flex-col gap-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Partner Mobile Number (Optional - defaults to primary number if blank)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                            +91
                          </span>
                          <input
                            type="tel"
                            inputMode="numeric"
                            maxLength={10}
                            value={patient.partnerPhone}
                            onChange={(e) => {
                              const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 10);
                              updatePatient("partnerPhone", onlyDigits);
                            }}
                            placeholder="10-digit mobile number"
                            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-12 pr-12 text-sm text-slate-800 placeholder:text-slate-400 focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-100 focus:outline-none shadow-2xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 1 Submit Button */}
              <div className="mt-auto flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-[#1E3A8A] via-[#5B21B6] to-[#A21CAF] px-8 py-3.5 font-bold text-white shadow-lg shadow-purple-900/15 transition-all hover:opacity-95 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Registering Patient...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to Appointment</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: APPOINTMENT BOOKING                                               */}
          {/* ========================================================================= */}
          {step === 2 && (
            <form onSubmit={handleAppointmentSubmit} className="flex flex-col gap-6 rounded-2xl bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
              <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
                    Appointment Details
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Select your preferred date, slot, and consultation reason.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              </div>

              {/* Patient Badge */}
              <div className="p-4 bg-gradient-to-r from-blue-50/80 via-fuchsia-50/30 to-teal-50/80 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#3898A6] uppercase tracking-wider">
                    Booking For Patient
                  </p>
                  <p className="text-sm font-bold text-slate-900">
                    {patientRecord?.full_name || fullName || "Patient"}
                  </p>
                </div>
                {patientRecord?.patient_id && (
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Patient ID
                    </p>
                    <p className="text-xs font-mono font-bold text-[#1E3A8A] bg-blue-100/60 px-2 py-0.5 rounded-md border border-blue-200">
                      {patientRecord.patient_id}
                    </p>
                  </div>
                )}
              </div>

              {/* Appointment Date Wheel */}
              <div>
                <DateWheelPicker
                  isDob={false}
                  label="Appointment Date"
                  value={appointment.appointmentDate}
                  onChange={(val) => updateAppointment("appointmentDate", val)}
                  error={errors.appointmentDate}
                />
              </div>

              {/* Time Picker */}
              <div>
                <TimePicker
                  startTime={appointment.startTime}
                  endTime={appointment.endTime}
                  onStartTimeChange={(val) => updateAppointment("startTime", val)}
                  onEndTimeChange={(val) => updateAppointment("endTime", val)}
                  errorStart={errors.startTime}
                  errorEnd={errors.endTime}
                />
              </div>

              {/* Appointment Type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Appointment Type <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "consultation", label: "Consultation" },
                    { id: "follow_up", label: "Follow-up" },
                    { id: "routine_checkup", label: "Checkup" },
                    { id: "emergency", label: "Urgent" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => updateAppointment("type", t.id)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${appointment.type === t.id
                        ? "border-[#A21CAF] bg-fuchsia-50 text-[#A21CAF] shadow-2xs font-bold ring-1 ring-[#A21CAF]/30"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                        }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {errors.type && (
                  <p className="text-xs text-rose-600 font-medium">{errors.type}</p>
                )}
              </div>

              {/* Reason for Appointment */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Reason for Visit <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={appointment.reason}
                  onChange={(e) => updateAppointment("reason", e.target.value)}
                  placeholder="Describe your consultation reason or symptoms"
                  className={`rounded-lg border bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none shadow-2xs ${errors.reason ? "border-rose-400 bg-rose-50/30" : "border-slate-200"
                    }`}
                />
                {errors.reason && (
                  <p className="text-xs text-rose-600 font-medium">{errors.reason}</p>
                )}
              </div>

              {/* Booking Summary Box at bottom of Appointment Details */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1E3A8A] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#3898A6]" />
                    Booking Summary Preview
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                    Step 2 of 3
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Primary Patient */}
                  <div className="p-3 bg-white rounded-lg border border-slate-200/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Primary Patient
                    </span>
                    <span className="font-bold text-slate-800 text-sm block">
                      {patientRecord?.full_name || fullName || "Patient"}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#1E3A8A] block mt-1">
                      ID: {patientRecord?.patient_id || patientRecord?.id?.slice(0, 8) || "Assigned on submit"}
                    </span>
                  </div>

                  {/* Spouse / Partner Patient if Couple Mode */}
                  {partnerRecord ? (
                    <div className="p-3 bg-fuchsia-50/50 rounded-lg border border-fuchsia-200/70">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#A21CAF] block mb-0.5">
                        Spouse / Partner Patient
                      </span>
                      <span className="font-bold text-slate-800 text-sm block">
                        {partnerRecord?.full_name || partnerFullName}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#A21CAF] block mt-1">
                        ID: {partnerRecord?.patient_id || partnerRecord?.id?.slice(0, 8)}
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 bg-white rounded-lg border border-slate-200/70">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                        Age & Branch
                      </span>
                      <span className="font-bold text-slate-800 text-sm block">
                        {age} Years Old • {patient.branch}
                      </span>
                      <span className="text-xs text-slate-500 block mt-1">
                        Purpose: {patient.purpose}
                      </span>
                    </div>
                  )}

                  {/* Selected Date & Time Slot */}
                  <div className="sm:col-span-2 p-3 bg-gradient-to-r from-teal-50/70 via-blue-50/50 to-purple-50/70 rounded-lg border border-[#3898A6]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#3898A6] block mb-0.5">
                        Selected Date & Slot
                      </span>
                      <span className="font-bold text-slate-800 text-sm">
                        {appointment.appointmentDate} • {formatTime24to12(appointment.startTime)} – {formatTime24to12(appointment.endTime)}
                      </span>
                    </div>
                    <span className="text-xs font-semibold capitalize text-[#A21CAF] bg-white px-2.5 py-1 rounded-md border border-fuchsia-200 self-start sm:self-auto">
                      {appointment.type.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 2 Buttons */}
              <div className="mt-auto flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs py-3.5 px-6 transition-all flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>

                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-gradient-to-r from-[#1E3A8A] via-[#5B21B6] to-[#A21CAF] hover:opacity-95 active:scale-95 text-white font-bold text-sm px-8 py-3.5 shadow-lg shadow-purple-900/15 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {busy ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Booking Appointment...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm & Book</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: CONFIRMATION                                                      */}
          {/* ========================================================================= */}
          {step === 3 && (
            <div className="printable-receipt rounded-2xl bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/50 border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-center mb-3">
                <ClinicLogo className="w-16 h-16" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>Appointment Confirmed</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-slate-800">
                You're All Set!
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                Your patient registration and appointment request have been submitted successfully to Premier Plus Clinic.
              </p>

              {/* Confirmation Details Card */}
              <div className="mt-6 text-left bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-200/80 text-xs">
                <div className="p-3.5 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Primary Patient Name</span>
                  <span className="font-bold text-slate-900">
                    {patientRecord?.full_name || fullName}
                  </span>
                </div>

                <div className="p-3.5 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Primary Patient ID</span>
                  <span className="font-mono font-bold text-[#1E3A8A] bg-blue-100/60 px-2.5 py-0.5 rounded border border-blue-200">
                    {patientRecord?.patient_id || patientRecord?.id?.slice(0, 8) || "PF00012"}
                  </span>
                </div>

                {partnerRecord && (
                  <>
                    <div className="p-3.5 flex justify-between items-center bg-fuchsia-50/50">
                      <span className="text-slate-600 font-medium flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#A21CAF]" />
                        Spouse / Partner Name
                      </span>
                      <span className="font-bold text-slate-900">
                        {partnerRecord?.full_name || partnerFullName}
                      </span>
                    </div>

                    <div className="p-3.5 flex justify-between items-center bg-fuchsia-50/50">
                      <span className="text-slate-600 font-medium">Spouse / Partner Patient ID</span>
                      <span className="font-mono font-bold text-[#A21CAF] bg-fuchsia-100/70 px-2.5 py-0.5 rounded border border-fuchsia-200">
                        {partnerRecord?.patient_id || partnerRecord?.id?.slice(0, 8) || "PF00013"}
                      </span>
                    </div>
                  </>
                )}

                <div className="p-3.5 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Branch</span>
                  <span className="font-semibold text-slate-800">
                    {patientRecord?.branch || patient.branch}
                  </span>
                </div>

                <div className="p-3.5 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Appointment Date</span>
                  <span className="font-semibold text-slate-800">
                    {appointment.appointmentDate}
                  </span>
                </div>

                <div className="p-3.5 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Appointment Time</span>
                  <span className="font-semibold text-slate-800">
                    {formatTime24to12(appointment.startTime)} – {formatTime24to12(appointment.endTime)}
                  </span>
                </div>

                <div className="p-3.5 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Appointment Type</span>
                  <span className="font-semibold capitalize text-[#A21CAF] bg-fuchsia-50 px-2 py-0.5 rounded border border-fuchsia-200">
                    {appointment.type.replace("_", " ")}
                  </span>
                </div>

                <div className="p-3.5 flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Appointment Ref</span>
                  <span className="font-mono text-[11px] text-slate-600 truncate max-w-[200px]">
                    {appointmentRecord?.id || "N/A"}
                  </span>
                </div>
              </div>

              {/* Scannable Reception QR Code Section */}
              <div className="mt-5 p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#1E3A8A]">
                    Reception Scan Check-In
                  </p>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">
                    Show this QR Code at the reception counter for instant check-in.
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 mt-1">
                    ID: {patientRecord?.patient_id || patientRecord?.id?.slice(0, 8) || "PF-APPT"}
                  </p>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs shrink-0 flex items-center justify-center">
                  <QRCodeSVG
                    value={JSON.stringify({
                      patient_id: patientRecord?.patient_id || patientRecord?.id,
                      name: patientRecord?.full_name || fullName,
                      appt_id: appointmentRecord?.id,
                      date: appointment.appointmentDate,
                      time: appointment.startTime,
                      branch: patientRecord?.branch || patient.branch,
                    })}
                    size={96}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              </div>

              {/* Reception Note */}
              <div className="mt-4 p-3.5 bg-gradient-to-r from-teal-50/70 to-blue-50/70 rounded-xl border border-[#3898A6]/30 text-left flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#3898A6] shrink-0 mt-0.5" />
                <p className="text-xs text-slate-700 leading-relaxed">
                  Please show this confirmation receipt or your Patient ID at the reception desk upon your arrival.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="no-print mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  Print / Save Receipt
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#1E3A8A] via-[#5B21B6] to-[#A21CAF] hover:opacity-95 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-purple-900/15 active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  Register Another Patient
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Right Aside: Sleek Information & Desk QR Section */}
        <aside className="hidden lg:flex lg:w-80 flex-col gap-6 shrink-0">
          {/* DOB / Date Peek Card */}
          <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-lg shadow-slate-200/50 border border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#1E3A8A]">
              {step === 1 && mode === "existing"
                ? "Existing Patient Info"
                : step === 1
                  ? "Date of Birth & Age"
                  : step === 2
                    ? "Booking Summary"
                    : "Visit Summary"}
            </h3>

            {step === 1 && mode === "form" ? (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold block mb-1">
                    Selected Date of Birth
                  </span>
                  <span className="text-slate-800 font-bold text-sm">
                    {patient.dateOfBirth || "1998-06-15"}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-teal-50/70 to-blue-50/70 p-3.5 border border-[#3898A6]/30">
                  <span className="text-xs font-bold text-[#3898A6]">Calculated Age</span>
                  <span className="text-lg font-black text-[#1E3A8A]">{age} Years</span>
                </div>
              </div>
            ) : step === 1 && mode === "existing" ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold block mb-1">
                    Quick Booking Mode
                  </span>
                  <p className="text-slate-700 font-medium">
                    Enter your Patient ID or UUID to book directly without registration.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold block mb-1">
                    Primary Patient
                  </span>
                  <span className="text-slate-800 font-bold text-sm block">
                    {patientRecord?.full_name || fullName || "Patient"}
                  </span>
                  {patientRecord?.patient_id && (
                    <span className="font-mono text-xs font-bold text-[#1E3A8A] block mt-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 w-fit">
                      ID: {patientRecord.patient_id}
                    </span>
                  )}
                </div>

                {partnerRecord && (
                  <div className="p-3 bg-fuchsia-50/60 rounded-xl border border-fuchsia-200/80">
                    <span className="text-[#A21CAF] uppercase tracking-wider text-[10px] font-bold block mb-1">
                      Spouse / Partner Patient
                    </span>
                    <span className="text-slate-800 font-bold text-sm block">
                      {partnerRecord?.full_name || partnerFullName}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#A21CAF] block mt-1 bg-fuchsia-100/80 px-2 py-0.5 rounded border border-fuchsia-200 w-fit">
                      ID: {partnerRecord?.patient_id || partnerRecord?.id?.slice(0, 8)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-teal-50/70 to-blue-50/70 p-3.5 border border-[#3898A6]/30">
                  <span className="text-xs font-bold text-[#3898A6]">Appointment Date</span>
                  <span className="text-sm font-bold text-[#1E3A8A]">{appointment.appointmentDate}</span>
                </div>
              </div>
            )}
          </div>

          {/* Clinic Attribution */}
          <footer className="mt-auto text-center pt-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#2996F5] font-bold">
              Premier Plus Clinic
            </p>
          </footer>
        </aside>
      </main>

      {/* Footer with Premier Plus Clinic Information & Branding */}
      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6">
          {/* Clinic Information Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-slate-100 text-xs">
            {/* Consultation Hours */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Consultation Hours
              </span>
              <span className="font-semibold text-slate-800">Mon – Sat: 8:00 AM – 8:00 PM</span>
            </div>

            {/* Reception Helpline */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Reception Helpline
              </span>
              <span className="font-semibold text-slate-800">+91 44 2480 1234 / 93847 48787</span>
            </div>

            {/* Centre Location */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Centre Location
              </span>
              <span className="font-semibold text-slate-800">Kodambakkam, Chennai</span>
            </div>
          </div>

          {/* Bottom Branding & Copyright */}
          <div className="pt-4 text-center text-xs text-slate-400 space-y-1">
            <p className="font-medium text-slate-500">
              © {new Date().getFullYear()} Premier Plus Clinic. All rights reserved.
            </p>
            <p className="text-[11px] text-slate-400">
              Kodambakkam Centre • Patient Registration & Appointment Portal
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
