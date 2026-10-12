import { expect, test } from "@playwright/test";
import { confirmDialog, newPage, signIn, uniqueId } from "./helpers";

test("secretary manages a full student record", async ({ page, browser }) => {
  const id = uniqueId();
  const name = `Student ${id}`;
  await signIn(page, "secretary@school.test");

  // Create (no invite yet)
  await page.goto("/office/students/new");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(`e2e.student.${id}@school.test`);
  await page.getByLabel("Birth date").fill("2012-03-04");
  await page.getByLabel("Send the student an invite link now").uncheck();
  await page.getByRole("button", { name: "Add student" }).click();
  await expect(page.getByText("Student added")).toBeVisible();
  await page.getByRole("link", { name: "Open student record" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText(/^S\d{4}-\d{3,}/)).toBeVisible();

  // Edit
  await page.getByLabel("Phone", { exact: true }).fill("+57 300 123 4567");
  await page.getByLabel("Medical notes").fill("Peanut allergy");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByText("Student record saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Medical notes")).toHaveValue("Peanut allergy");

  // Guardian
  await page.getByRole("tab", { name: /Guardians/ }).click();
  await page.getByLabel("Guardian name").fill(`Guardian ${id}`);
  await page.getByLabel("Guardian email").fill(`e2e.guardian.${id}@school.test`);
  await page.getByLabel("Relationship").selectOption("Mother");
  await page.getByRole("button", { name: "Create and link guardian" }).click();
  await expect(page.getByText("Guardian linked.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Invite link" })).toHaveValue(/\/set-password\//);
  await expect(page.getByText(`Guardian ${id}`)).toBeVisible();

  // Document upload + authorized download
  await page.getByRole("tab", { name: /Documents/ }).click();
  await page.getByLabel("File", { exact: true }).setInputFiles({
    name: "enrollment form.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% e2e test file\n"),
  });
  await page.getByLabel("Type").selectOption("CONTRACT");
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByText("Document uploaded.")).toBeVisible();
  const download = page.getByRole("link", { name: "Download enrollment-form.pdf" });
  const href = (await download.getAttribute("href"))!;
  const res = await page.request.get(href);
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("e2e test file");

  // A teacher can't fetch it.
  const teacher = await newPage(browser);
  await signIn(teacher, "teacher1@school.test");
  expect((await teacher.request.get(href)).status()).toBe(404);

  // Delete
  await page.getByRole("button", { name: "Delete enrollment-form.pdf" }).click();
  await confirmDialog(page, "Delete");
  await expect(page.getByText("Document deleted.")).toBeVisible();
  expect((await page.request.get(href)).status()).toBe(404);
});

test("secretary imports students from CSV with a preview", async ({ page }) => {
  const id = uniqueId();
  const csv = [
    "name,email,birthDate,guardianName,guardianEmail,guardianRelationship",
    `Import One ${id},e2e.import1.${id}@school.test,2011-01-01,Parent ${id},e2e.importparent.${id}@school.test,Mother`,
    `Import Two ${id},e2e.import2.${id}@school.test,,,,`,
    `Already There,student01@school.test,,,,`,
  ].join("\n");

  await signIn(page, "secretary@school.test");
  await page.goto("/office/students/import");
  await page.getByLabel("CSV file").setInputFiles({ name: "students.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });

  const summary = page.getByTestId("import-summary");
  await expect(summary).toContainText("3 rows");
  await expect(summary).toContainText("2 ready");
  await expect(summary).toContainText("1 with errors");
  await expect(page.getByText("an account with this email already exists")).toBeVisible();

  await page.getByRole("button", { name: "Import 2 students" }).click();
  await expect(page.getByText("Imported 2 students", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download invite links" })).toBeVisible();

  await page.goto(`/office/students?q=${encodeURIComponent(`Import One ${id}`)}`);
  await page.getByRole("link", { name: `Import One ${id}` }).click();
  await page.getByRole("tab", { name: /Guardians/ }).click();
  await expect(page.getByText(`Parent ${id}`)).toBeVisible();
});

test("student directory exports CSV and is closed to other roles", async ({ page, browser }) => {
  await signIn(page, "secretary@school.test");
  const res = await page.request.get("/office/students/export.csv?q=student01");
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain("studentCode,name,email");
  expect(body).toContain("student01@school.test");
  expect(body).not.toContain("medicalNotes");

  const teacher = await newPage(browser);
  await signIn(teacher, "teacher1@school.test");
  await teacher.goto("/office/students");
  await expect(teacher).toHaveURL(/\/forbidden$/);
  expect((await teacher.request.get("/office/students/export.csv")).status()).toBe(404);
});
