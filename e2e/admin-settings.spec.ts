import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("admin updates settings and the change is audited", async ({ page }) => {
  await signIn(page, "admin@school.test");
  await page.goto("/admin/settings");

  const score = page.getByLabel("Passing score (%)");
  const original = await score.inputValue();
  const next = original === "70" ? "65" : "70";

  await score.fill(next);
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Passing score (%)")).toHaveValue(next);

  await page.goto("/admin/audit-log?action=settings.update");
  const row = page.getByRole("row").filter({ hasText: "settings.update" }).first();
  await expect(row).toContainText("Ada Admin");
  await expect(row).toContainText("academic");

  // Restore the original value.
  await page.goto("/admin/settings");
  await page.getByLabel("Passing score (%)").fill(original);
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
});

test("invalid settings show field errors", async ({ page }) => {
  await signIn(page, "admin@school.test");
  await page.goto("/admin/settings");
  await page.getByLabel("Time zone").fill("Mars/Olympus");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Unknown time zone")).toBeVisible();
});
