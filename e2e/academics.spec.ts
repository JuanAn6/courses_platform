import { expect, test, type Page } from "@playwright/test";
import { confirmDialog, newPage, signIn, uniqueId } from "./helpers";

/** Searches the "Add students" list and waits for the filtered results. */
async function searchStudents(page: Page, name: string) {
  await page.getByLabel("Search students").fill(name);
  await page.getByRole("button", { name: "Search" }).click();
  await page.waitForURL((url) => url.searchParams.get("q") === name);
}

/** Creates a class through the admin UI and returns its URL. */
async function createClass(page: Page, opts: { course: string; name: string; code: string; capacity?: number; status?: string }) {
  await page.goto("/admin/classes/new");
  await page.getByLabel("Course", { exact: true }).selectOption({ label: opts.course });
  await page.getByLabel("Term").selectOption({ label: "2026 Fall" });
  await page.getByLabel("Class name").fill(opts.name);
  await page.getByLabel("Class code").fill(opts.code);
  if (opts.capacity) await page.getByLabel("Capacity").fill(String(opts.capacity));
  await page.getByLabel("Status").selectOption({ label: opts.status ?? "Active" });
  await page.getByRole("button", { name: "Create class" }).click();
  await expect(page).toHaveURL(/\/admin\/classes\/[^/]+$/);
  await expect(page.getByRole("heading", { name: opts.name })).toBeVisible();
  return page.url();
}

test("admin builds a course and a class, and the teacher sees it", async ({ page, browser }) => {
  const id = uniqueId();
  await signIn(page, "admin@school.test");

  // Category
  await page.goto("/admin/categories");
  await page.getByLabel("Name").fill(`Arts ${id}`);
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(page.getByText("Category created.")).toBeVisible();

  // Course
  await page.goto("/admin/courses/new");
  await page.getByLabel("Code").fill(`ART-${id}`);
  await page.getByLabel("Title").fill(`Drawing ${id}`);
  await page.getByLabel("Summary").fill("Sketching from observation.");
  await page.getByLabel("Category").selectOption({ label: `Arts ${id}` });
  await page.getByLabel("Status").selectOption({ label: "Published" });
  await page.getByRole("button", { name: "Create course" }).click();
  await expect(page.getByRole("heading", { name: `Drawing ${id}` })).toBeVisible();
  await expect(page.getByRole("link", { name: "View in catalog" })).toBeVisible();

  // Editor
  await page.getByLabel("Teacher").selectOption({ label: "Tina Teacher" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Editor added.")).toBeVisible();

  // Class with a teacher
  await createClass(page, { course: `Drawing ${id} (ART-${id.toUpperCase()})`, name: `Drawing ${id} · A`, code: `ART-${id}-A` });
  await page.getByLabel("Person").selectOption({ label: "Tomás Teacher" });
  await page.getByRole("button", { name: "Add to staff" }).click();
  await expect(page.getByText("Tomás Teacher added.")).toBeVisible();

  const teacher = await newPage(browser);
  await signIn(teacher, "teacher1@school.test");
  await teacher.goto("/teach");
  await teacher.getByRole("link", { name: new RegExp(`Drawing ${id} · A`) }).click();
  await expect(teacher.getByRole("heading", { name: `Drawing ${id} · A` })).toBeVisible();
  await expect(teacher.getByText("No students enrolled yet.")).toBeVisible();
});

test("course and class validation", async ({ page }) => {
  await signIn(page, "admin@school.test");
  await page.goto("/admin/courses/new");
  await page.getByLabel("Code").fill("MATH-101");
  await page.getByLabel("Title").fill("Duplicate");
  await page.getByRole("button", { name: "Create course" }).click();
  await expect(page.getByText("Course code MATH-101 is already in use.")).toBeVisible();

  await page.goto("/admin/classes/new");
  await page.getByRole("button", { name: "Create class" }).click();
  await expect(page.getByText("Choose a course", { exact: true })).toBeVisible();
  await expect(page.getByText("Enter a name", { exact: true })).toBeVisible();
});

test("office enrolls, enforces capacity, withdraws and moves students", async ({ page, browser }) => {
  test.setTimeout(60_000);
  const id = uniqueId();
  const admin = await newPage(browser);
  await signIn(admin, "admin@school.test");
  const classUrl = await createClass(admin, {
    course: "Algebra I (MATH-101)",
    name: `Algebra I · Small ${id}`,
    code: `MATH-101-S${id}`,
    capacity: 2,
  });
  const classId = classUrl.split("/").pop()!;

  await signIn(page, "secretary@school.test");
  await page.goto(`/office/enrollments?classId=${classId}`);
  await expect(page.getByRole("link", { name: "Class settings" })).toBeVisible();
  await expect(page.getByLabel("Class", { exact: true })).toHaveValue(classId);

  // Enroll two students
  for (const name of ["Ethan Wilson", "Noah Smith"]) {
    await searchStudents(page, name);
    await page.getByRole("checkbox", { name: new RegExp(name) }).check();
    await page.getByRole("button", { name: /Enroll 1 selected/ }).click();
    await expect(page.getByText("Enrolled 1 student.")).toBeVisible();
  }
  await expect(page.getByText("2 / 2")).toBeVisible();

  // Capacity is enforced
  await searchStudents(page, "Liam Torres");
  await page.getByRole("checkbox", { name: /Liam Torres/ }).check();
  await page.getByRole("button", { name: /Enroll 1 selected/ }).click();
  await expect(page.getByText("Not enough seats: 0 of 2 left.")).toBeVisible();

  // Withdraw one
  await page.getByRole("checkbox", { name: "Select Noah Smith" }).check();
  await page.getByRole("button", { name: "Withdraw selected" }).click();
  await confirmDialog(page, "Withdraw");
  await expect(page.getByText("Withdrew 1 student.")).toBeVisible();
  await page.getByText(/Past students/).click();
  await expect(page.getByText("Withdrawn")).toBeVisible();

  // Move the other to Biology
  await page.getByRole("button", { name: "Move Ethan Wilson" }).click();
  await page.getByLabel("Move to").selectOption({ label: "Biology Basics — Biology · Fall (SCI-120-26F)" });
  await page.getByRole("button", { name: "Move student" }).click();
  await expect(page.getByText("Student moved.")).toBeVisible();

  // The student record shows the history
  await page.goto("/office/students?q=student09%40school.test");
  await page.getByRole("link", { name: "Ethan Wilson" }).click();
  await page.getByRole("tab", { name: /Enrollments/ }).click();
  await expect(page.getByText(new RegExp(`Moved to SCI-120-26F`))).toBeVisible();
  await expect(page.getByText("Biology Basics — Biology · Fall")).toBeVisible();
});

test("public catalog and student self-enrollment", async ({ page }) => {
  await page.goto("/catalog");
  await expect(page.getByRole("link", { name: /Algebra I/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Spanish for Beginners/ })).toBeVisible();
  await expect(page.getByText("Biology Basics")).toHaveCount(0);

  await page.goto("/catalog/algebra-i");
  await expect(page.getByText("Enrollment through the office")).toBeVisible();
  await page.goto("/catalog/biology-basics");
  await expect(page.getByText(/could not be found|404/i).first()).toBeVisible();

  await page.goto("/catalog/spanish-for-beginners");
  await page.getByRole("link", { name: "Sign in to enroll" }).click();
  await page.getByLabel("Email").fill("student10@school.test");
  await page.getByLabel("Password").fill("Password123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/catalog\/spanish-for-beginners$/);

  await page.getByRole("button", { name: "Enroll", exact: true }).click();
  await confirmDialog(page, "Enroll");
  await expect(page).toHaveURL(/\/learn\/classes\//);
  await expect(page.getByRole("heading", { name: "Spanish for Beginners" })).toBeVisible();

  await page.goto("/learn");
  await expect(page.getByRole("link", { name: /Spanish for Beginners/ })).toBeVisible();
  await page.goto("/catalog/spanish-for-beginners");
  await expect(page.getByRole("link", { name: "Go to class" })).toBeVisible();
});

test("class pages are limited to their members", async ({ page, browser }) => {
  await signIn(page, "student01@school.test");
  await page.goto("/learn");
  await page.getByRole("link", { name: /Algebra I/ }).click();
  await expect(page.getByRole("heading", { name: "Algebra I" })).toBeVisible();
  await expect(page.getByText("Tomás Teacher")).toBeVisible();
  const algebraUrl = page.url();

  const spanishStudent = await newPage(browser);
  await signIn(spanishStudent, "student08@school.test");
  await spanishStudent.goto("/learn");
  await spanishStudent.getByRole("link", { name: /Spanish for Beginners/ }).click();
  await expect(spanishStudent).toHaveURL(/\/learn\/classes\//);
  const spanishUrl = spanishStudent.url();

  await page.goto(spanishUrl);
  await expect(page).toHaveURL(/\/forbidden$/);

  const teacher = await newPage(browser);
  await signIn(teacher, "teacher1@school.test");
  await teacher.goto(spanishUrl.replace("/learn/", "/teach/"));
  await expect(teacher).toHaveURL(/\/forbidden$/);
  await teacher.goto(algebraUrl.replace("/learn/", "/teach/"));
  await expect(teacher.getByText("Liam Torres")).toBeVisible();

  const guardian = await newPage(browser);
  await signIn(guardian, "guardian@school.test");
  await guardian.goto("/guardian");
  await expect(guardian.getByText("Algebra I").first()).toBeVisible();
});
