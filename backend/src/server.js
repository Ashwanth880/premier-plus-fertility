import { createApp } from "./app.js";
import { config } from "./config.js";
import { closePool, createPool, migrate } from "./mysql.js";

const pool = createPool(config.database);

try {
  await migrate(pool);
  const app = createApp({ ...config, databasePool: pool });
  const server = app.listen(config.port, config.host, () => {
    console.log(`Backend listening on http://${config.host}:${config.port}`);
  });
  const shutdown = async () => {
    server.close(async () => {
      await closePool(pool);
      process.exit(0);
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
} catch (error) {
  console.error("Backend startup failed:", error.message);
  await closePool(pool);
  process.exitCode = 1;
}
