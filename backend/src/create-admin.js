import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { config } from "./config.js";
import { hashPassword } from "./password.js";
import { closePool, createPool, migrate } from "./mysql.js";
import { createMysqlStore } from "./mysql-store.js";

function promptSecret(question) {
  return new Promise((resolve) => {
    output.write(question);
    input.setRawMode?.(true);
    input.resume();
    let value = "";
    const onData = (chunk) => {
      const character = chunk.toString();
      if (character === "\u0003") process.exit(1);
      if (character === "\r" || character === "\n") {
        input.setRawMode?.(false);
        input.pause();
        input.off("data", onData);
        output.write("\n");
        resolve(value);
      } else if (character === "\u007f") {
        value = value.slice(0, -1);
      } else {
        value += character;
      }
    };
    input.on("data", onData);
  });
}

const pool = createPool(config.database);
await migrate(pool);
const store = createMysqlStore(pool);
const rl = readline.createInterface({ input, output });

try {
  const email = (await rl.question("Admin email: ")).trim().toLowerCase();
  const fullName = (await rl.question("Admin full name: ")).trim();
  rl.close();
  const password = await promptSecret("Admin password (minimum 12 characters): ");
  const confirmation = await promptSecret("Confirm password: ");

  if (!email || !fullName || password.length < 12 || password !== confirmation) {
    throw new Error("Email, name, matching passwords, and a password of at least 12 characters are required.");
  }
  if (store.findUserByEmail(email)) throw new Error("An account with that email already exists.");

  store.upsertUser({
    id: store.randomUUID(),
    email,
    password_hash: hashPassword(password),
    full_name: fullName,
    role: "admin",
    is_active: true,
    created_at: new Date().toISOString(),
  });
  console.log(`Admin account created for ${email}. Start the backend and sign in with this account.`);
} finally {
  rl.close();
  await closePool(pool);
}