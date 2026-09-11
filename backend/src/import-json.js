import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { closePool, createPool, migrate } from "./mysql.js";
import { isWithinSchedule } from "./scheduling.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = path.resolve(currentDirectory, "../data");
const reportPath = path.join(dataDirectory, "import-report.json");

async function readJson(name) {
  return JSON.parse(await fs.readFile(path.join(dataDirectory, name), "utf8"));
}

function mysqlDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp: ${value}`);
  return date.toISOString().slice(0, 23).replace("T", " ");
}

const report = { imported: { users: 0, patients: 0, appointments: 0 }, quarantined: [] };
const pool = createPool(config.database);

try {
  await migrate(pool);
  const [branches] = await pool.query("SELECT id, name, code FROM branches");
  const branch = branches.find((item) => item.name === "Kodambakkam") || branches[0];
  const patients = await readJson("patients.json");
  const patientIds = new Set();

  for (const patient of patients) {
    const normalizedPhone = String(patient.phone || "").replace(/\D/g, "");
    try {
      await pool.query(
        `INSERT INTO patients (id, patient_id, title, first_name, last_name, full_name, age, date_of_birth, gender, phone, normalized_phone, branch_id, purpose, referral_source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [patient.id, patient.patient_id, patient.title || "Mr", patient.first_name, patient.last_name, patient.full_name, patient.age || 0, patient.date_of_birth, patient.gender, patient.phone, normalizedPhone, branch.id, patient.purpose, patient.referral_source || "Unknown", mysqlDateTime(patient.created_at)]
      );
      patientIds.add(patient.id);
      report.imported.patients += 1;
    } catch (error) {
      report.quarantined.push({ type: "patient", id: patient.id, reason: error.code === "ER_DUP_ENTRY" ? "DUPLICATE_PATIENT_PHONE_OR_ID" : error.message });
    }
  }

  const appointments = await readJson("appointments.json");
  for (const appointment of appointments) {
    if (!patientIds.has(appointment.patient_id)) {
      report.quarantined.push({ type: "appointment", id: appointment.id, reason: "PATIENT_NOT_IMPORTED" });
      continue;
    }
    if (!isWithinSchedule(appointment.start_time, appointment.end_time, config.schedule)) {
      report.quarantined.push({ type: "appointment", id: appointment.id, reason: "INVALID_SLOT_OR_LUNCH_OVERLAP" });
      continue;
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        `INSERT INTO appointments (id, patient_id, branch_id, doctor_id, appointment_date, start_time, end_time, type, reason, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [appointment.id, appointment.patient_id, branch.id, appointment.doctor_id || null, appointment.appointment_date, appointment.start_time, appointment.end_time, appointment.type, appointment.reason, appointment.status === "cancelled" ? "cancelled" : "scheduled", mysqlDateTime(appointment.created_at)]
      );
      if (appointment.status !== "cancelled") {
        await connection.query("INSERT INTO appointment_slot_locks (branch_id, appointment_date, start_time, appointment_id) VALUES (?, ?, ?, ?)", [branch.id, appointment.appointment_date, appointment.start_time, appointment.id]);
      }
      await connection.commit();
      report.imported.appointments += 1;
    } catch (error) {
      await connection.rollback();
      report.quarantined.push({ type: "appointment", id: appointment.id, reason: error.code === "ER_DUP_ENTRY" ? "SLOT_CONFLICT" : error.message });
    } finally {
      connection.release();
    }
  }

  const users = await readJson("users.json");
  for (const user of users) {
    try {
      await pool.query("INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [user.id, user.email, user.password_hash, user.full_name, user.role, user.is_active, mysqlDateTime(user.created_at)]);
      report.imported.users += 1;
    } catch (error) {
      report.quarantined.push({ type: "user", id: user.id, reason: error.code === "ER_DUP_ENTRY" ? "DUPLICATE_USER" : error.message });
    }
  }

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally {
  await closePool(pool);
}
