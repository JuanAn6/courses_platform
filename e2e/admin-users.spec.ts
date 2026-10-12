import { expect, test, type Page } from "@playwright/test";
import { acceptLink, confirmDialog, newPage, signIn, uniqueId } from "./helpers";

/** Invites a user through the admin UI and returns their invite link. */
async function inviteUser(page: Page, opts: { name: string; email: string; role: string }) {
  await page.goto("/admin/users/new");
  await page.getByLabel("Full name").fill(opts.name);
  await page.getByLabel("Email").fill(opts.email);
  await page.getByRole("checkbox", { name: new RegExp(`^${opts.role}`) }).check();
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText("User created")).toBeVisible();
  return page.getByRole("textbox", { name: "Invite link" }).inputValue();
}

test("admin invites a teacher who activates the account with the link", async ({ page, browser }) => {
  const id = uniqueId();
  const email = `e2e.teacher.${id}@school.test`;
  await signIn(page, "admin@school.test");
  const link = await inviteUser(page, { name: `Teacher ${id}`, email, role: "Teacher" });
  expect(link).toContain("/set-password/");

  const teacher = await acceptLink(browser, link, "Teacher-Pass-123");
  await expect(teacher.getByRole("navigation", { name: "Main" }).first().getByRole("heading", { name: "Teaching" })).toBeVisible();

  // Links are single-use.
  const again = await newPage(browser);
  await again.goto(link);
  await expect(again.getByText("Link expired")).toBeVisible();

  // The user list shows them as active.
  await page.goto(`/admin/users?q=${encodeURIComponent(email)}`);
  const row = page.getByRole("row").filter({ hasText: email });
  await expect(row).toContainText("Active");
  await expect(row).toContainText("Teacher");
});

test("invite form keeps input and shows errors", async ({ page }) => {
  await signIn(page, "admin@school.test");
  await page.goto("/admin/users/new");
  await page.getByLabel("Full name").fill("No Role Person");
  await page.getByLabel("Email").fill("admin@school.test");
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText("Choose at least one role")).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue("No Role Person");

  await page.getByRole("checkbox", { name: /^Teacher/ }).check();
  await page.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText("Another account already uses this email.")).toBeVisible();
});

test("admin suspends, reactivates and resets a password", async ({ page, browser }) => {
  const id = uniqueId();
  const name = `Suspend ${id}`;
  await signIn(page, "admin@school.test");
  const link = await inviteUser(page, { name, email: `e2e.suspend.${id}@school.test`, role: "Secretary" });
  const user = await acceptLink(browser, link, "First-Pass-123");

  await page.getByRole("link", { name: "View user" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();

  await page.getByRole("button", { name: "Suspend account" }).click();
  await confirmDialog(page, "Suspend");
  await expect(page.getByText("Account suspended.")).toBeVisible();
  await user.goto("/dashboard");
  await expect(user).toHaveURL(/\/login/);

  await page.getByRole("button", { name: "Reactivate account" }).click();
  await confirmDialog(page, "Reactivate");
  await expect(page.getByText("Account reactivated.")).toBeVisible();

  await page.getByRole("button", { name: "Send password reset link" }).click();
  await confirmDialog(page, "Send link");
  const resetUrl = await page.getByRole("textbox", { name: "Reset link" }).inputValue();
  const afterReset = await acceptLink(browser, resetUrl, "Second-Pass-456");
  await expect(afterReset.getByRole("heading", { name: /Welcome/ })).toBeVisible();
});

test("admin can view the platform as a student and stop", async ({ page }) => {
  await signIn(page, "admin@school.test");
  await page.goto("/admin/users?q=student02%40school.test");
  await page.getByRole("link", { name: "Emma García" }).click();

  await page.getByRole("button", { name: "View as Emma" }).click();
  await confirmDialog(page, "Start");

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("status").filter({ hasText: "viewing the platform as" })).toContainText("Emma García");
  const nav = page.getByRole("navigation", { name: "Main" }).first();
  await expect(nav.getByRole("heading", { name: "Learning" })).toBeVisible();
  await expect(nav.getByRole("heading", { name: "Administration" })).toHaveCount(0);
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/forbidden$/);

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Stop viewing as Emma" }).click();
  await expect(page).toHaveURL(/\/admin\/users\/.+/);
  await expect(page.getByText("viewing the platform as")).toHaveCount(0);

  await page.goto("/admin/audit-log?action=user.impersonate");
  await expect(page.getByRole("row").filter({ hasText: "user.impersonate.start" }).first()).toContainText("Ada Admin");
});

test("admins can't lock themselves out", async ({ page }) => {
  await signIn(page, "admin@school.test");
  await page.goto("/admin/users?q=admin%40school.test");
  await page.getByRole("link", { name: "Ada Admin" }).click();

  await expect(page.getByRole("button", { name: "Suspend account" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Archive account" })).toHaveCount(0);

  await page.getByRole("checkbox", { name: /^Administrator/ }).uncheck();
  await page.getByRole("checkbox", { name: /^Teacher/ }).check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("You can't remove your own administrator role.")).toBeVisible();
});

test("non-admins can't manage users", async ({ page }) => {
  await signIn(page, "secretary@school.test");
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/forbidden$/);
});
