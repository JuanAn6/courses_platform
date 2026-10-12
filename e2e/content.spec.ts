import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { confirmDialog, newPage, signIn, uniqueId } from "./helpers";

async function openAlgebraBuilder(page: Page) {
  await page.goto("/teach");
  await page.getByRole("link", { name: "Algebra I", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Algebra I", level: 1 })).toBeVisible();
}

async function addContent(page: Page, unitTitle: string, typeLabel: string) {
  await page.getByRole("button", { name: `Add content to ${unitTitle}` }).click();
  await page.getByRole("menuitem", { name: new RegExp(`^${typeLabel}`) }).click();
  await expect(page).toHaveURL(/\/teach\/entries\//);
}

async function openAlgebraClass(page: Page) {
  await page.goto("/learn");
  await page.getByRole("link", { name: /Algebra I/ }).click();
  await expect(page.getByRole("heading", { name: "Algebra I", level: 1 })).toBeVisible();
}

test("teacher builds a unit with a published text lesson and reorders units", async ({ page }) => {
  const id = uniqueId();
  const unitTitle = `E2E unit ${id}`;
  await signIn(page, "teacher1@school.test");
  await openAlgebraBuilder(page);

  await page.getByLabel("New unit title").fill(unitTitle);
  await page.getByRole("button", { name: "Add unit" }).click();
  await expect(page.getByRole("region", { name: `Unit: ${unitTitle}` })).toBeVisible();

  await addContent(page, unitTitle, "Text");
  await page.getByLabel("Title").fill(`Lesson ${id}`);
  await page.getByRole("textbox", { name: "Content" }).click();
  await page.keyboard.type("Hello students, this is the lesson body.");
  await page.getByLabel("Status").selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved and published.")).toBeVisible();

  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByText("Hello students, this is the lesson body.")).toBeVisible();

  // Back in the builder, move the new unit up one place.
  await openAlgebraBuilder(page);
  // Other tests add units to this course in parallel, so compare with the unit just above ours.
  const regions = page.getByRole("region", { name: /^Unit: / });
  const labels = () => regions.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const before = await labels();
  const above = before[before.indexOf(`Unit: ${unitTitle}`) - 1];
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/teach/courses/"));
  await page.getByRole("button", { name: `Move unit ${unitTitle} up` }).click();
  await saved;
  await page.reload();
  const after = await labels();
  expect(after.indexOf(`Unit: ${unitTitle}`)).toBe(after.indexOf(above) - 1);
});

test("publishing is blocked until content is complete", async ({ page }) => {
  const id = uniqueId();
  await signIn(page, "teacher1@school.test");
  await openAlgebraBuilder(page);
  await page.getByLabel("New unit title").fill(`Validation ${id}`);
  await page.getByRole("button", { name: "Add unit" }).click();
  await addContent(page, `Validation ${id}`, "Link");
  await page.getByLabel("Web address").fill("javascript:alert(1)");
  await page.getByLabel("Status").selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Enter a web address starting with https/).first()).toBeVisible();

  await page.getByLabel("Web address").fill("https://example.com/practice");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved and published.")).toBeVisible();
});

test("a PowerPoint upload is converted into slides", async ({ page }) => {
  test.setTimeout(120_000);
  const id = uniqueId();
  await signIn(page, "teacher1@school.test");
  await openAlgebraBuilder(page);
  await page.getByLabel("New unit title").fill(`Slides ${id}`);
  await page.getByRole("button", { name: "Add unit" }).click();
  await addContent(page, `Slides ${id}`, "Presentation");

  await page.getByLabel("Upload slides").setInputFiles(path.join(__dirname, "fixtures", "slides.pptx"));
  await expect(page.getByText("Converting to slides…")).toBeVisible();
  await expect(page.getByText(/Ready\. Use Preview/)).toBeVisible({ timeout: 90_000 });
  await page.getByLabel("Status").selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved and published.")).toBeVisible();

  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByText("Slide 1 of 3")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Next slide" }).click();
  await expect(page.getByText("Slide 2 of 3")).toBeVisible();
});

test("student works through lessons; prerequisites unlock and progress is tracked", async ({ page, browser }) => {
  test.setTimeout(90_000);
  await signIn(page, "student02@school.test");
  await openAlgebraClass(page);
  await expect(page.getByText(/Complete “Unit 1: Expressions and equations” first/)).toBeVisible();

  const done = async (title: string) => {
    await openAlgebraClass(page);
    await page.getByRole("link", { name: title }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Mark as done" }).click();
    await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  };
  await done("What is an equation?");
  await done("Solving one-step equations");
  await done("Cheat sheet");

  // Unit 2 is now open; the slides complete when the last one is reached.
  await openAlgebraClass(page);
  await expect(page.getByText(/Complete “Unit 1/)).toHaveCount(0);
  await page.getByRole("link", { name: /Introduction to functions/ }).click();
  await expect(page.getByText("Slide 1 of 3")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Next slide" }).click();
  await page.getByRole("button", { name: "Next slide" }).click();
  await expect(page.getByText("Slide 3 of 3")).toBeVisible();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();

  await openAlgebraClass(page);
  await expect(page.getByRole("progressbar", { name: "Your progress" })).not.toHaveAttribute("aria-valuenow", "0");

  // The teacher sees it in the roster.
  const teacher = await newPage(browser);
  await signIn(teacher, "teacher1@school.test");
  await teacher.goto("/teach");
  await teacher.getByRole("link", { name: /Algebra I · Group A/ }).click();
  const row = teacher.getByRole("row").filter({ hasText: "Emma García" });
  await expect(row.getByLabel(/% complete/)).not.toHaveAttribute("aria-label", "0% complete");
});

test("class overrides hide content for one class; assistants can't change them", async ({ page, browser }) => {
  await signIn(page, "teacher1@school.test");
  await page.goto("/teach");
  await page.getByRole("link", { name: /Algebra I · Group A/ }).click();
  await page.getByRole("link", { name: "Content" }).click();

  await page.getByRole("button", { name: "Class settings for Extra practice on Khan Academy" }).click();
  await page.getByLabel("Hide from students in this class").check();
  await page.getByRole("button", { name: "Save for this class" }).click();
  await expect(page.getByText("Saved for this class.")).toBeVisible();

  const student = await newPage(browser);
  await signIn(student, "student03@school.test");
  await openAlgebraClass(student);
  await expect(student.getByText("Cheat sheet")).toBeVisible();
  await expect(student.getByText("Extra practice on Khan Academy")).toHaveCount(0);

  await page.getByRole("button", { name: "Class settings for Extra practice on Khan Academy" }).click();
  await page.getByRole("button", { name: "Use course settings" }).click();
  await expect(page.getByText("Saved for this class.")).toBeVisible();
  await openAlgebraClass(student);
  await expect(student.getByText("Extra practice on Khan Academy")).toBeVisible();

  const assistant = await newPage(browser);
  await signIn(assistant, "assistant@school.test");
  await assistant.goto(page.url());
  await expect(assistant.getByText("Cheat sheet")).toBeVisible();
  await expect(assistant.getByRole("button", { name: /^Class settings for/ })).toHaveCount(0);
  await expect(assistant.getByText("View only")).toBeVisible();
});

test("class-only units and builder permissions", async ({ page, browser }) => {
  const id = uniqueId();
  await signIn(page, "teacher1@school.test");
  await page.goto("/teach");
  await page.getByRole("link", { name: /Algebra I · Group A/ }).click();
  await page.getByRole("link", { name: "Content" }).click();
  await page.getByLabel("New unit title").fill(`Group A extras ${id}`);
  await page.getByRole("button", { name: "Add unit" }).click();
  await expect(page.getByRole("region", { name: `Unit: Group A extras ${id}` })).toBeVisible();

  const builderUrl = await (async () => {
    await page.getByRole("link", { name: "Edit course content" }).click();
    await expect(page).toHaveURL(/\/teach\/courses\//);
    return page.url();
  })();

  const other = await newPage(browser);
  await signIn(other, "teacher2@school.test");
  await other.goto(builderUrl);
  await expect(other).toHaveURL(/\/forbidden$/);
});

test("deleting a unit asks for confirmation", async ({ page }) => {
  const id = uniqueId();
  await signIn(page, "teacher1@school.test");
  await openAlgebraBuilder(page);
  await page.getByLabel("New unit title").fill(`Temp ${id}`);
  await page.getByRole("button", { name: "Add unit" }).click();
  await page.getByRole("button", { name: `Delete unit Temp ${id}` }).click();
  await confirmDialog(page, "Delete");
  await expect(page.getByText("Unit deleted.")).toBeVisible();
  await expect(page.getByRole("region", { name: `Unit: Temp ${id}` })).toHaveCount(0);
});

test("duplicating a course copies its units and lessons", async ({ page }) => {
  const id = uniqueId();
  await signIn(page, "admin@school.test");
  await page.goto("/admin/courses?q=MATH-101");
  await page.getByRole("link", { name: "Algebra I", exact: true }).click();
  await page.getByLabel("New title").fill(`Algebra copy ${id}`);
  await page.getByLabel("New code").fill(`ALG-${id}`);
  await page.getByRole("button", { name: "Duplicate course" }).click();
  await expect(page.getByRole("heading", { name: `Algebra copy ${id}` })).toBeVisible();
  await page.getByRole("link", { name: "Edit content" }).click();
  await expect(page.getByRole("region", { name: "Unit: Unit 1: Expressions and equations" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cheat sheet" })).toBeVisible();
  await expect(page.getByText("After “Unit 1: Expressions and equations”")).toBeVisible();
});
