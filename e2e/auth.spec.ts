import { expect, test } from "@playwright/test";
import { PASSWORD, signIn } from "./helpers";

test("anonymous users are sent to login and returned to the page they wanted", async ({ page }) => {
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fsettings/);

  await page.getByLabel("Email").fill("admin@school.test");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/admin\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("a wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@school.test");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText("Invalid email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("signing out ends the session", async ({ page }) => {
  await signIn(page, "teacher1@school.test");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("a user can change their password, which signs out their other sessions", async ({ page, browser }) => {
  const email = "student03@school.test";
  const temporary = "Temporary-Pass-123";
  const otherDevice = await (await browser.newContext()).newPage();
  await signIn(otherDevice, email);
  await signIn(page, email);

  const change = async (current: string, next: string) => {
    await page.goto("/profile");
    await page.getByLabel("Current password").fill(current);
    await page.getByLabel("New password", { exact: true }).fill(next);
    await page.getByLabel("Confirm new password").fill(next);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText(/Password changed/)).toBeVisible();
  };

  await change(PASSWORD, temporary);
  try {
    // This session survives; the other device is signed out.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    await otherDevice.goto("/dashboard");
    await expect(otherDevice).toHaveURL(/\/login/);
  } finally {
    // Restore the seed password so other tests keep working.
    await change(temporary, PASSWORD);
  }
});
