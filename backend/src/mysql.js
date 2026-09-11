import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(currentDirectory, "../migrations");

export function createPool(databaseConfig) {
  return mysql.createPool({
    host: databaseConfig.host,
    port: databaseConfig.port,
    user: databaseConfig.user,
    password: databaseConfig.password,
    database: databaseConfig.name,
    waitForConnections: true,
    connectionLimit: databaseConfig.connectionLimit,
    namedPlaceholders: true,
    decimalNumbers: true,
    timezone: "Z",
  });
}

export async function migrate(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    )
  `);

  const [appliedRows] = await pool.query("SELECT version FROM schema_migrations");
  const applied = new Set(appliedRows.map((row) => row.version));
  const files = (await fs.readdir(migrationsDirectory)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await fs.readFile(path.join(migrationsDirectory, file), "utf8");
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const statement of sql.split(/;\s*(?:\r?\n|$)/).map((item) => item.trim()).filter(Boolean)) {
        await connection.query(statement);
      }
      await connection.query("INSERT INTO schema_migrations (version) VALUES (?)", [file]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export async function closePool(pool) {
  await pool.end();
}
