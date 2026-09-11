import "dotenv/config";

export const config = {
  port: Number(process.env.BACKEND_PORT || 4000),
  host: process.env.BACKEND_HOST || "127.0.0.1",
  jwtSecret: process.env.JWT_SECRET,
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  database: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    name: process.env.MYSQL_DATABASE || "premier_plus_fertility",
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
  },
  dataDirectory: process.env.DATA_DIRECTORY || "backend/data",
  timezone: process.env.CLINIC_TIMEZONE || "Asia/Kolkata",
  schedule: {
    openingTime: process.env.CLINIC_OPENING_TIME || "08:00",
    closingTime: process.env.CLINIC_CLOSING_TIME || "20:00",
    lunchStart: process.env.CLINIC_LUNCH_START || "11:30",
    lunchEnd: process.env.CLINIC_LUNCH_END || "12:30",
    slotMinutes: 15,
  },
  tokenTtlSeconds: Number(process.env.TOKEN_TTL_SECONDS || 3600),
};
