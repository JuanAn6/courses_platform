import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const CASES = [
  { email: "admin@school.test", sections: ["Administration", "Office", "Teaching"], allowed: "/admin", denied: "/learn" },
  { email: "secretary@school.test", sections: ["Office"], allowed: "/office", denied: "/admin" },
  { email: "teacher1@school.test", sections: ["Teaching"], allowed: "/teach", denied: "/office" },
  { email: "assistant@school.test", sections: ["Teaching"], allowed: "/teach", denied: "/admin/settings" },
  { email: "student01@school.test", sections: ["Learning"], allowed: "/learn", denied: "/teach" },
  { email: "guardian@school.test", sections: ["My students"], allowed: "/guardian", denied: "/office" },
];

for (const c of CASES) {
  test(`${c.email} sees only their areas`, async ({ page }) => {
    await signIn(page, c.email);

    const nav = page.getByRole("navigation", { name: "Main" }).first();
    for (const section of c.sections) {
      await expect(nav.getByRole("heading", { name: section, exact: true })).toBeVisible();
    }
    const hidden = ["Administration", "Office", "Teaching", "Learning", "My students"].filter(
      (s) => !c.sections.includes(s),
    );
    for (const section of hidden) {
      await expect(nav.getByRole("heading", { name: section, exact: true })).toHaveCount(0);
    }

    await page.goto(c.allowed);
    await expect(page).toHaveURL(new RegExp(`${c.allowed}$`));

    await page.goto(c.denied);
    await expect(page).toHaveURL(/\/forbidden$/);
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  });
}

test("guardians see their linked students", async ({ page }) => {
  await signIn(page, "guardian@school.test");
  await page.goto("/guardian");
  await expect(page.getByText("Liam Torres")).toBeVisible();
  await expect(page.getByText("Emma García")).toBeVisible();
});
