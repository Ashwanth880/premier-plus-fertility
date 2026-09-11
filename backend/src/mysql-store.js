import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";

const ACTIVE_STATUSES = ["scheduled", "checked_in"];

function toDateTime(value) {
  return value instanceof Date ? value : new Date(value);
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

export function createMysqlStore(pool) {
  function requestHash(body) {
    return createHash("sha256").update(JSON.stringify(body)).digest("hex");
  }

  async function findBranch(branch) {
    const [rows] = await pool.query(
      "SELECT id, code, name, timezone FROM branches WHERE is_active = TRUE AND (code = ? OR name = ?) LIMIT 1",
      [String(branch).toUpperCase(), branch]
    );
    return rows[0] || null;
  }

  async function findPatientById(id, connection = pool) {
    const [rows] = await connection.query(
      `SELECT p.*, b.code AS branch_code, b.name AS branch_name
       FROM patients p JOIN branches b ON b.id = p.branch_id
       WHERE p.id = ? OR p.patient_id = ? LIMIT 1`,
      [id, id]
    );
    return rows[0] || null;
  }

  async function findAppointmentById(id, connection = pool) {
    const [rows] = await connection.query(
      `SELECT a.*, p.patient_id AS patient_reference, b.code AS branch_code, b.name AS branch_name
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN branches b ON b.id = a.branch_id
       WHERE a.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  async function createPatient(body, connection = pool) {
    const branch = await findBranch(body.branch);
    if (!branch) {
      const error = new Error("Branch not found.");
      error.code = "BRANCH_NOT_FOUND";
      throw error;
    }
    const patient = {
      id: randomUUID(),
      patient_id: body.patient_id || `PF${Math.floor(10000 + Math.random() * 90000)}`,
      title: body.title || "Mr",
      first_name: body.first_name.trim(),
      last_name: body.last_name.trim(),
      full_name: body.full_name || `${body.title || ""} ${body.first_name} ${body.last_name}`.trim(),
      age: Number(body.age) || 0,
      date_of_birth: body.date_of_birth,
      gender: body.gender.trim(),
      phone: body.phone.replace(/\s+/g, ""),
      normalized_phone: normalizePhone(body.phone),
      branch_id: branch.id,
      branch: branch.name,
      purpose: body.purpose.trim(),
      referral_source: body.referral_source || "Unknown",
      created_at: new Date(),
    };
    await connection.query(
      `INSERT INTO patients
       (id, patient_id, title, first_name, last_name, full_name, age, date_of_birth, gender, phone, normalized_phone, branch_id, purpose, referral_source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [patient.id, patient.patient_id, patient.title, patient.first_name, patient.last_name, patient.full_name, patient.age, patient.date_of_birth, patient.gender, patient.phone, patient.normalized_phone, patient.branch_id, patient.purpose, patient.referral_source, patient.created_at]
    );
    return patient;
  }

  async function reserveAppointment(body, schedule) {
    const connection = await pool.getConnection();
    const appointmentId = randomUUID();
    try {
      await connection.beginTransaction();
      const patient = await findPatientById(body.patient_id, connection);
      if (!patient) {
        const error = new Error("Patient not found.");
        error.code = "PATIENT_NOT_FOUND";
        throw error;
      }
      const branch = await findBranch(body.branch || patient.branch_name);
      if (!branch) {
        const error = new Error("Branch not found.");
        error.code = "BRANCH_NOT_FOUND";
        throw error;
      }

      const appointment = {
        id: appointmentId,
        patient_id: patient.id,
        patient_reference: patient.patient_id,
        doctor_id: body.doctor_id || null,
        branch_id: branch.id,
        branch: branch.name,
        appointment_date: body.appointment_date,
        start_time: body.start_time,
        end_time: body.end_time,
        type: body.type,
        reason: body.reason.trim(),
        status: "scheduled",
        created_at: new Date(),
      };
      await connection.query(
        `INSERT INTO appointments
         (id, patient_id, branch_id, doctor_id, appointment_date, start_time, end_time, type, reason, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [appointment.id, appointment.patient_id, appointment.branch_id, appointment.doctor_id, appointment.appointment_date, appointment.start_time, appointment.end_time, appointment.type, appointment.reason, appointment.status, appointment.created_at]
      );
      await connection.query(
        `INSERT INTO appointment_slot_locks (branch_id, appointment_date, start_time, appointment_id)
         VALUES (?, ?, ?, ?)`,
        [branch.id, body.appointment_date, body.start_time, appointmentId]
      );
      await connection.commit();
      return appointment;
    } catch (error) {
      await connection.rollback();
      if (error.code === "ER_DUP_ENTRY") {
        const conflict = new Error("This appointment slot is no longer available.");
        conflict.code = "SLOT_UNAVAILABLE";
        throw conflict;
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  return {
    hashRequest: requestHash,
    async getIdempotency(operation, key) {
      const [rows] = await pool.query("SELECT * FROM idempotency_keys WHERE operation = ? AND idempotency_key = ? AND expires_at > UTC_TIMESTAMP(3) LIMIT 1", [operation, key]);
      return rows[0] || null;
    },
    async claimIdempotency(operation, key, body) {
      const hash = requestHash(body);
      try {
        await pool.query(
          `INSERT INTO idempotency_keys (operation, idempotency_key, request_hash, response_status, response_body, expires_at)
           VALUES (?, ?, ?, 0, JSON_OBJECT(), DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 24 HOUR))`,
          [operation, key, hash]
        );
        return { claimed: true, hash };
      } catch (error) {
        if (error.code !== "ER_DUP_ENTRY") throw error;
        const existing = await this.getIdempotency(operation, key);
        if (!existing) return { claimed: true, hash };
        if (existing.request_hash !== hash) {
          const conflict = new Error("This idempotency key was already used with a different request.");
          conflict.code = "IDEMPOTENCY_KEY_REUSE";
          throw conflict;
        }
        return { claimed: false, existing };
      }
    },
    async completeIdempotency(operation, key, status, body) {
      await pool.query("UPDATE idempotency_keys SET response_status = ?, response_body = ? WHERE operation = ? AND idempotency_key = ?", [status, JSON.stringify(body), operation, key]);
    },
    async releaseIdempotency(operation, key) {
      await pool.query("DELETE FROM idempotency_keys WHERE operation = ? AND idempotency_key = ? AND response_status = 0", [operation, key]);
    },
    async health() {
      await pool.query("SELECT 1 AS ok");
      return true;
    },
    findUserByEmail: async (email) => {
      const [rows] = await pool.query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
      return rows[0] || null;
    },
    upsertUser: async (user) => {
      await pool.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), full_name = VALUES(full_name), role = VALUES(role), is_active = VALUES(is_active)`,
        [user.id, user.email, user.password_hash, user.full_name, user.role, user.is_active, user.created_at]
      );
      return user;
    },
    createPatient,
    findPatientById,
    listPatients: async () => {
      const [rows] = await pool.query("SELECT * FROM patients ORDER BY created_at DESC");
      return rows;
    },
    reserveAppointment,
    findAppointmentById,
    listAppointments: async () => {
      const [rows] = await pool.query("SELECT * FROM appointments ORDER BY appointment_date, start_time");
      return rows;
    },
    async availableSlots(branchName, date, schedule) {
      const branch = await findBranch(branchName);
      if (!branch) return null;
      const [rows] = await pool.query(
        `SELECT start_time FROM appointments
         WHERE branch_id = ? AND appointment_date = ? AND status IN (?, ?)
         UNION
         SELECT start_time FROM appointment_slot_locks
         WHERE branch_id = ? AND appointment_date = ?`,
        [branch.id, date, ACTIVE_STATUSES[0], ACTIVE_STATUSES[1], branch.id, date]
      );
      return { branch, bookedStarts: new Set(rows.map((row) => String(row.start_time).slice(0, 5))) };
    },
    async cancelAppointment(id, actorUserId) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const appointment = await findAppointmentById(id, connection);
        if (!appointment) return null;
        await connection.query("UPDATE appointments SET status = 'cancelled' WHERE id = ? AND status IN ('scheduled', 'checked_in')", [id]);
        await connection.query("DELETE FROM appointment_slot_locks WHERE appointment_id = ?", [id]);
        await connection.query("INSERT INTO appointment_events (appointment_id, event_type, actor_user_id, metadata) VALUES (?, 'cancelled', ?, JSON_OBJECT())", [id, actorUserId]);
        await connection.commit();
        return { ...appointment, status: "cancelled" };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
    async rescheduleAppointment(id, body, schedule, actorUserId) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const appointment = await findAppointmentById(id, connection);
        if (!appointment) return null;
        const branch = await findBranch(body.branch || appointment.branch_name);
        if (!branch) {
          const error = new Error("Branch not found.");
          error.code = "BRANCH_NOT_FOUND";
          throw error;
        }
        await connection.query("DELETE FROM appointment_slot_locks WHERE appointment_id = ?", [id]);
        await connection.query(
          "INSERT INTO appointment_slot_locks (branch_id, appointment_date, start_time, appointment_id) VALUES (?, ?, ?, ?)",
          [branch.id, body.appointment_date, body.start_time, id]
        );
        await connection.query(
          `UPDATE appointments SET branch_id = ?, appointment_date = ?, start_time = ?, end_time = ?, updated_at = CURRENT_TIMESTAMP(3)
           WHERE id = ? AND status = 'scheduled'`,
          [branch.id, body.appointment_date, body.start_time, body.end_time, id]
        );
        await connection.query("INSERT INTO appointment_events (appointment_id, event_type, actor_user_id, metadata) VALUES (?, 'rescheduled', ?, ?)", [id, actorUserId, JSON.stringify({ appointment_date: body.appointment_date, start_time: body.start_time, end_time: body.end_time })]);
        await connection.commit();
        return findAppointmentById(id);
      } catch (error) {
        await connection.rollback();
        if (error.code === "ER_DUP_ENTRY") {
          const conflict = new Error("This appointment slot is no longer available.");
          conflict.code = "SLOT_UNAVAILABLE";
          throw conflict;
        }
        throw error;
      } finally {
        connection.release();
      }
    },
    async connection() {
      return pool.getConnection();
    },
    toDateTime,
  };
}
