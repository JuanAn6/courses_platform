import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().regex(/^(mysql|mariadb):\/\//, "Must be a mysql:// or mariadb:// URL"),
  BETTER_AUTH_SECRET: z.string().min(32, "Must be at least 32 characters"),
  APP_URL: z.url().default("http://localhost:3000"),
  /** e.g. smtp://user:pass@smtp.example.com:587. When unset, emails are logged to the console. */
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default("Course Platform <no-reply@localhost>"),
  /** Local file storage root (S3-compatible storage arrives in phase 4). */
  STORAGE_DIR: z.string().default("./storage"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  throw new Error("Invalid environment variables. See .env.example.");
}

export const env = parsed.data;
