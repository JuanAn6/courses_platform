/**
 * Recreates the E2E database from scratch: drop, create, migrate, seed.
 * Runs before the E2E server starts (see playwright.config.ts), so no connections are open.
 */
import { execSync } from "node:child_process";
import mariadb from "mariadb";
import { parseDatabaseUrl } from "../src/lib/db-url";

const url = process.env.E2E_DATABASE_URL ?? "mysql://root@localhost:3306/course_platform_e2e";
const { database, ...server } = parseDatabaseUrl(url);
if (!database?.includes("e2e") && !database?.includes("test")) {
  throw new Error(`Refusing to reset "${database}": the E2E database name must contain "e2e" or "test".`);
}

const conn = await mariadb.createConnection({ ...server, connectionLimit: undefined } as mariadb.ConnectionConfig);
await conn.query(`DROP DATABASE IF EXISTS \`${database}\``);
await conn.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
await conn.end();

const env = { ...process.env, DATABASE_URL: url };
execSync("npx prisma migrate deploy", { stdio: "inherit", env });
execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
console.log(`E2E database ${database} is ready.`);
