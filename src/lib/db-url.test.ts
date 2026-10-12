import { describe, expect, it } from "vitest";
import { parseDatabaseUrl } from "./db-url";

describe("parseDatabaseUrl", () => {
  it("parses a passwordless local URL", () => {
    expect(parseDatabaseUrl("mysql://root@localhost:3306/course_platform")).toMatchObject({
      host: "localhost",
      port: 3306,
      user: "root",
      password: undefined,
      database: "course_platform",
    });
  });

  it("decodes credentials and reads connection_limit", () => {
    const cfg = parseDatabaseUrl("mysql://app%40x:p%23ss@db.example.com/lms?connection_limit=3");
    expect(cfg).toMatchObject({ user: "app@x", password: "p#ss", port: 3306, database: "lms", connectionLimit: 3 });
  });

  it("rejects other protocols and a missing database", () => {
    expect(() => parseDatabaseUrl("postgres://u@h/db")).toThrow(/protocol/);
    expect(() => parseDatabaseUrl("mysql://u@h")).toThrow(/database name/);
  });
});
