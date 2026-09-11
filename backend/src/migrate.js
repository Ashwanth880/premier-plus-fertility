import { config } from "./config.js";
import { closePool, createPool, migrate } from "./mysql.js";

const pool = createPool(config.database);

try {
  await migrate(pool);
  console.log(`MySQL migrations applied to ${config.database.name}.`);
} catch (error) {
  console.error("MySQL migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await closePool(pool);
}
