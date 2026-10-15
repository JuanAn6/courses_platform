import { expect, test, type Page } from "@playwright/test";
import { confirmDialog, newPage, openConfirm, signIn, uniqueId } from "./helpers";

async function openAlgebraEntry(page: Page, title: string) {
  await page.goto("/learn");
  await page.getByRole("link", { name: /Algebra I/ }).click();
  await page.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
}

test("student takes a quiz, the teacher grades the essay, and the student sees the result", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await signIn(page, "student05@school.test");
  await openAlgebraEntry(page, "Unit 1 quiz");
  await expect(page.getByText("20 minute limit")).toBeVisible();
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page).toHaveURL(/\/quiz\//);
  await expect(page.getByRole("timer")).toBeVisible();

  const q = (n: number) => page.locator("[aria-labelledby]").filter({ has: page.locator(`h2:has-text("Question ${n}")`) }).first();
  await q(1).getByLabel("x = 4").check();
  await q(2).getByLabel("True", { exact: true }).check();
  await q(3).getByLabel("Your answer").fill("4");
  await q(4).getByLabel("Your answer").fill("Variable");
  await q(5).getByLabel("x + 1 = 5").check();
  await q(5).getByLabel("2y = 10").check();
  await q(6).getByLabel("Blank 1").fill("5");
  await q(6).getByLabel("Blank 2").fill("seven");
  await q(7).getByLabel("x + 2 = 5").selectOption({ label: "x = 3" });
  await q(7).getByLabel("2x = 8").selectOption({ label: "x = 4" });
  await q(7).getByLabel("x - 1 = 9").selectOption({ label: "x = 10" });
  // Order the steps: move each into place with the buttons.
  const steps = ["Subtract 3 from both sides", "Get 2x = 8", "Divide both sides by 2", "x = 4"];
  for (let target = 0; target < steps.length; target++) {
    const items = q(8).getByRole("listitem");
    let index = (await items.allTextContents()).findIndex((t) => t.includes(steps[target]));
    while (index > target) {
      await q(8).getByRole("button", { name: `Move “${steps[target]}” up` }).click();
      index--;
    }
  }
  await q(9).getByLabel("Your answer").fill("Because an equation is a balance, so whatever we do to one side we must also do to the other.");

  await page.getByRole("button", { name: "Submit quiz" }).click();
  await confirmDialog(page, "Submit");
  await expect(page).toHaveURL(/\/results$/);
  await expect(page.getByText("Some answers are waiting for your teacher")).toBeVisible();
  // All auto-graded questions are right: 10 of 13 points before the essay.
  await expect(page.getByText(/^10\s*\/ 13$/)).toBeVisible();

  // Teacher grades the essay from the queue.
  const teacher = await newPage(browser);
  await signIn(teacher, "teacher1@school.test");
  await teacher.goto("/teach/grading");
  await teacher.getByRole("row").filter({ hasText: "Lucas Brown" }).filter({ hasText: "Unit 1 quiz" }).getByRole("link").click();
  await teacher.getByLabel("Score for question 9").fill("2.5");
  await teacher.getByLabel("Feedback for question 9").fill("Good explanation.");
  await teacher.getByRole("button", { name: "Save score" }).first().click();
  await expect(teacher.getByText("Score saved.")).toBeVisible();
  await expect(teacher.getByText("Graded", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText(/^12\.5\s*\/ 13$/)).toBeVisible();
  await expect(page.getByText("Passed")).toBeVisible();
  await expect(page.getByText("Good explanation.")).toBeVisible();

  await page.goto("/learn/grades");
  await expect(page.getByRole("row").filter({ hasText: "Unit 1 quiz" })).toContainText("12.5 / 13");
});

test("quiz attempts are limited and a second attempt can be started", async ({ page }) => {
  await signIn(page, "student01@school.test");
  for (const label of ["Start quiz", "Start a new attempt"]) {
    await openAlgebraEntry(page, "Unit 1 quiz");
    await page.getByRole("button", { name: label }).click();
    await expect(page).toHaveURL(/\/quiz\//);
    await page.getByRole("button", { name: "Submit quiz" }).click();
    await confirmDialog(page, "Submit");
    await expect(page).toHaveURL(/\/results$/);
  }
  await openAlgebraEntry(page, "Unit 1 quiz");
  await expect(page.getByText("You've used all 2 attempts.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Start/ })).toHaveCount(0);
});

test("a timed quiz submits itself when time runs out", async ({ page }) => {
  await page.clock.install();
  await signIn(page, "student04@school.test");
  await openAlgebraEntry(page, "Speed check");
  await expect(page.getByText("1 minute limit")).toBeVisible();
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page).toHaveURL(/\/quiz\//);
  await expect(page.getByRole("timer")).toContainText(/0:5\d|1:00/);
  await page.clock.fastForward("01:05");
  await expect(page).toHaveURL(/\/results$/, { timeout: 15_000 });
});

test("student submits an assignment; the teacher grades it with the rubric", async ({ page, browser }) => {
  test.setTimeout(90_000);
  await signIn(page, "student06@school.test");
  await openAlgebraEntry(page, "Word problems");
  await expect(page.getByRole("rowheader", { name: "Equations" })).toBeVisible();
  await page.getByLabel("Your answer").fill("b + 3 = a, b = 5, so a = 8. 4t = 28, so t = 7.");
  await page.getByLabel("Attach file").setInputFiles({ name: "work.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% student work\n") });
  await expect(page.getByText("work.pdf")).toBeVisible();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await confirmDialog(page, "Submit");
  await expect(page.getByText("Submitted.", { exact: true })).toBeVisible();
  await expect(page.getByText("Waiting for your teacher to grade it.")).toBeVisible();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();

  const teacher = await newPage(browser);
  await signIn(teacher, "teacher1@school.test");
  await teacher.goto("/teach/grading");
  await teacher.getByRole("row").filter({ hasText: "Sofía López" }).filter({ hasText: "Word problems" }).getByRole("link").click();
  await expect(teacher.getByText("b + 3 = a")).toBeVisible();
  const fileLink = teacher.getByRole("link", { name: /work\.pdf/ });
  expect((await teacher.request.get((await fileLink.getAttribute("href"))!)).status()).toBe(200);
  await teacher.getByRole("group", { name: "Equations" }).getByRole("radio", { name: /^Correct/ }).check();
  await teacher.getByRole("group", { name: "Steps shown" }).getByRole("radio", { name: /^Some/ }).check();
  await expect(teacher.getByText("Total: 7 / 10")).toBeVisible();
  await teacher.getByLabel("Feedback").fill("Show the division step too.");
  await teacher.getByRole("button", { name: "Save grade" }).click();
  await expect(teacher.getByText("Grade saved and released.")).toBeVisible();

  await page.reload();
  await expect(page.getByText(/Grade:\s*7 \/ 10/)).toBeVisible();
  await expect(page.getByText("Show the division step too.")).toBeVisible();

  // Another student can't download this student's file.
  const other = await newPage(browser);
  await signIn(other, "student02@school.test");
  expect((await other.request.get((await fileLink.getAttribute("href"))!)).status()).toBe(404);

  // Resubmitting puts it back in the queue.
  await page.getByRole("button", { name: "Submit a new version" }).click();
  await page.getByLabel("Your answer").fill("Version 2 with the division step.");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await confirmDialog(page, "Submit");
  await expect(page.getByText("Resubmitted.")).toBeVisible();
  await teacher.goto("/teach/grading");
  await expect(teacher.getByRole("row").filter({ hasText: "Sofía López" }).filter({ hasText: "Version 2" })).toBeVisible();
});

test("teacher builds questions in the bank with validation", async ({ page }) => {
  test.setTimeout(60_000);
  const id = uniqueId();
  await signIn(page, "teacher1@school.test");
  await page.goto("/teach");
  await page.getByRole("link", { name: "Algebra I", exact: true }).click();
  await page.getByRole("link", { name: "Question bank" }).click();
  await expect(page.getByRole("link", { name: "Solve: x + 3 = 7" })).toBeVisible();
  await page.getByRole("link", { name: "New question" }).click();

  await page.getByLabel("Question type").selectOption("FILL_BLANKS");
  await page.getByRole("textbox", { name: "Question", exact: true }).click();
  await page.keyboard.type(`Capital question ${id}`);
  await page.getByLabel("Text with blanks").fill("The capital of France is Paris.");
  await page.getByRole("button", { name: "Save question" }).click();
  await expect(page.getByText(/Mark each blank like/).first()).toBeVisible();

  await page.getByLabel("Text with blanks").fill("The capital of France is [[Paris]].");
  await expect(page.getByLabel("Blank 1")).toBeVisible(); // live student preview
  await page.getByLabel("Tags").fill("geography, E2E");
  await page.getByRole("button", { name: "Save question" }).click();
  await expect(page.getByText("Question saved.")).toBeVisible();
  await expect(page).toHaveURL(/\/questions\/[^/]+$/);

  await page.getByRole("link", { name: "Question bank" }).click();
  await expect(page).toHaveURL(/\/questions$/);
  await page.getByLabel("Tag", { exact: true }).selectOption("e2e");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page).toHaveURL(/tag=e2e/);
  await expect(page.getByRole("link", { name: `Capital question ${id}` })).toBeVisible();
  await openConfirm(page, page.getByRole("button", { name: `Delete “Capital question ${id}”` }));
  await confirmDialog(page, "Delete");
  await expect(page.getByText(/Question deleted/)).toBeVisible();
});

test("teacher adds a quiz to the course from the bank", async ({ page }) => {
  const id = uniqueId();
  await signIn(page, "teacher1@school.test");
  await page.goto("/teach");
  await page.getByRole("link", { name: "Algebra I", exact: true }).click();
  await page.getByLabel("New unit title").fill(`Quiz unit ${id}`);
  await page.getByRole("button", { name: "Add unit" }).click();
  await page.getByRole("button", { name: `Add content to Quiz unit ${id}` }).click();
  await page.getByRole("menuitem", { name: /^Quiz/ }).click();
  await expect(page).toHaveURL(/\/teach\/entries\//);

  await page.getByLabel("Status").selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Add at least one question/).first()).toBeVisible();

  await page.getByRole("button", { name: "Add from bank" }).click();
  await page.getByRole("dialog").getByLabel(/Solve: x \+ 3 = 7/).check();
  await page.getByRole("dialog").getByLabel(/Solve 3x = 12/).check();
  await page.getByRole("button", { name: "Add 2 questions" }).click();
  await expect(page.getByText("2 questions · 2 points")).toBeVisible();
  await page.getByLabel("Time limit (minutes)").fill("10");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved and published.")).toBeVisible();

  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByText("10 minute limit")).toBeVisible();
});

test("grading pages are limited to the class's staff; attempts to their owner", async ({ page, browser }) => {
  // (student03's sessions are revoked by the password-change test, so use another student.)
  await signIn(page, "student01@school.test");
  await openAlgebraEntry(page, "Speed check");
  await page.getByRole("button", { name: "Start quiz" }).click();
  await expect(page).toHaveURL(/\/quiz\//);
  const attemptUrl = page.url();
  const attemptId = attemptUrl.split("/").pop()!;

  const otherStudent = await newPage(browser);
  await signIn(otherStudent, "student02@school.test");
  const res = await otherStudent.goto(attemptUrl);
  expect(res?.status()).toBe(404);

  const outsider = await newPage(browser);
  await signIn(outsider, "teacher2@school.test");
  await outsider.goto(`/teach/grading/attempts/${attemptId}`);
  await expect(outsider).toHaveURL(/\/forbidden$/);
  await outsider.goto("/teach/grading");
  await expect(outsider.getByText("Speed check")).toHaveCount(0);

  await page.getByRole("button", { name: "Submit quiz" }).click();
  await confirmDialog(page, "Submit");
  await expect(page).toHaveURL(/\/results$/);
});

