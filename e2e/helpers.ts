import { expect, type Browser, type Locator, type Page } from "@playwright/test";

export const PASSWORD = process.env.SEED_PASSWORD ?? "Password123!";

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** A separate browser context (its own cookies), e.g. "another person" in the same test. */
export async function newPage(browser: Browser) {
  return (await browser.newContext()).newPage();
}

/** Unique suffix so tests can be re-run against the same database. */
export function uniqueId() {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}

/** Confirms the open AlertDialog. */
export async function confirmDialog(page: Page, name: string | RegExp) {
  await page.getByRole("alertdialog").getByRole("button", { name }).click();
}

/** Completes an invite/reset link in its own browser context and returns the signed-in page. */
export async function acceptLink(browser: Browser, url: string, password: string) {
  const page = await newPage(browser);
  await page.goto(url);
  await page.getByLabel("New password").fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Set password and sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return page;
}

/**
 * Clicks a button that opens a confirmation dialog, retrying until it opens: right after a full
 * page load the button can be visible before React has hydrated it.
 */
export async function openConfirm(page: Page, button: Locator) {
  await expect(async () => {
    await button.click();
    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}
