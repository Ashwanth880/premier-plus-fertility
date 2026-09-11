import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { closePool, createPool, migrate } from "../src/mysql.js";

const mysqlConfigured = Boolean(process.env.MYSQL_TEST_DATABASE);

test("concurrent booking allows exactly one winner for a branch slot", { skip: !mysqlConfigured }, async () => {
  const pool = createPool({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    name: process.env.MYSQL_TEST_DATABASE,
    connectionLimit: 5,
  });
  await migrate(pool);
  const patientId = randomUUID();
  const phone = `9${String(Date.now()).slice(-9)}`;
  await pool.query(
    `INSERT INTO patients (id, patient_id, title, first_name, last_name, full_name, age, date_of_birth, gender, phone, normalized_phone, branch_id, purpose, referral_source)
     VALUES (?, ?, 'Mr', 'Concurrent', 'Test', 'Mr Concurrent Test', 30, '1995-01-01', 'male', ?, ?, '00000000-0000-0000-0000-000000000001', 'Testing', 'Automated')`,
    [patientId, `PFTEST${Date.now()}`, phone, phone]
  );
  const server = createApp({
    jwtSecret: "test-secret-that-is-at-least-32-characters",
    corsOrigin: "http://localhost:3000",
    schedule: { openingTime: "08:00", closingTime: "20:00", lunchStart: "11:30", lunchEnd: "12:30", slotMinutes: 15 },
    databasePool: pool,
  }).listen(0);
  const { port } = server.address();
  const payload = { patient_id: patientId, branch: "Kodambakkam", appointment_date: "2099-12-15", start_time: "10:00", end_time: "10:15", type: "consultation", reason: "Concurrency test" };
  try {
    const responses = await Promise.all([1, 2].map((index) => fetch(`http://127.0.0.1:${port}/api/appointments`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": `concurrency-${Date.now()}-${index}` }, body: JSON.stringify(payload) })));
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  } finally {
    server.close();
    await pool.query("DELETE FROM appointment_slot_locks WHERE branch_id = '00000000-0000-0000-0000-000000000001' AND appointment_date = '2099-12-15' AND start_time = '10:00'");
    await pool.query("DELETE FROM appointments WHERE patient_id = ?", [patientId]);
    await pool.query("DELETE FROM patients WHERE id = ?", [patientId]);
    await closePool(pool);
  }
});
