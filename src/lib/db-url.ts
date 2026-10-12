import type { PoolConfig } from "mariadb";

/** Converts a `mysql://user:pass@host:port/db` URL into a mariadb driver pool config. */
export function parseDatabaseUrl(url: string): PoolConfig {
  const u = new URL(url);
  if (u.protocol !== "mysql:" && u.protocol !== "mariadb:") {
    throw new Error(`Unsupported database protocol: ${u.protocol}`);
  }
  const database = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (!database) throw new Error("DATABASE_URL must include a database name");

  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password) || undefined,
    database,
    connectionLimit: Number(u.searchParams.get("connection_limit") ?? 10),
  };
}
