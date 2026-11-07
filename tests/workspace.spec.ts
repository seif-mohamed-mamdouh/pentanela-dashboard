import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockApi, vendors, summary } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});
test("overview uses backend values, honest status, fixed navigation and dismissible message", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Operations overview." }),
  ).toBeVisible();
  await expect(page.locator(".metric").nth(1)).toContainText("248");
  await expect(
    page.getByText("Credentials configured", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Not verified", { exact: true })).toBeVisible();
  await expect(page.locator(".health-ring")).toHaveAttribute(
    "aria-label",
    "8 verified, 3 need review, 1 inactive",
  );
  await page.screenshot({
    path: testInfo.outputPath("overview-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect(
    await page
      .locator(".sidebar")
      .evaluate((el) => el.getBoundingClientRect().top),
  ).toBe(0);
  await page.getByRole("button", { name: "Dismiss message" }).click();
  await expect(page.locator(".workspace-notice")).toHaveCount(0);
  await page.getByRole("button", { name: "Show workspace message" }).click();
  await expect(page.locator(".workspace-notice")).toBeVisible();
  expect(errors).toEqual([]);
});
test("vendor directory supports search, status, region, pagination and selection", async ({
  page,
}, testInfo) => {
  await page.goto("/vendor-accounts");
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page.getByRole("button", { name: "Verified", exact: false }).click();
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await page
    .getByRole("combobox", { name: "Filter by region" })
    .selectOption("NA");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page
    .getByRole("searchbox", { name: "Search accounts" })
    .fill("North America");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Select Pentanela North America",
      exact: true,
    })
    .click();
  await expect(page.locator("#vendor-selector")).toHaveValue("vendor-6");
  await expect(page.locator(".workspace-notice")).toContainText(
    "Working account updated",
  );
  await page.getByRole("searchbox").fill("");
  await page
    .getByRole("combobox", { name: "Filter by region" })
    .selectOption("");
  await page
    .getByRole("button", { name: "All accounts", exact: false })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("accounts-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
});
test("account context scopes products, resets pagination and preserves global totals", async ({
  page,
}) => {
  await page.goto("/products");
  await expect(page.locator("tbody tr")).toHaveCount(25);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("No records to show yet")).toBeVisible();
  const request = page.waitForRequest(
    (r) =>
      r.url().includes("/api/products?") &&
      r.url().includes("vendorAccountId=vendor-2") &&
      r.url().includes("page=1"),
  );
  await page.locator("#vendor-selector").selectOption("vendor-2");
  await request;
  await expect(page.locator("tbody tr")).toHaveCount(25);
  await expect(
    page.getByText("Page 1 · Search applies to the catalog"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.locator(".metric").first()).toContainText("12");
  await expect(page.locator(".scope-explanation")).toContainText(
    "Pentanela Emirates",
  );
});
test("dashboard failure never looks like no accounts need review", async ({
  page,
}) => {
  await page.route("**/api/vendor-accounts", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await page.route("**/api/dashboard/summary", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await page.goto("/dashboard");
  await expect(
    page.getByText("We could not check which accounts need attention."),
  ).toBeVisible();
  await expect(
    page.getByText("Status unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("You’re all caught up")).toHaveCount(0);
  await expect(
    page.getByText("The account selector could not load.", { exact: false }),
  ).toBeVisible();
});
test("empty data is distinct from filtered and failed data", async ({
  page,
}) => {
  await page.route("**/api/vendor-accounts", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto("/vendor-accounts");
  await expect(page.getByText("Your portfolio is ready to grow")).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByText("No accounts to review yet")).toBeVisible();
  await expect(page.getByText("You’re all caught up")).toHaveCount(0);
});
test("slow summary shows skeletons without a false setup warning", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/dashboard/summary", async (route) => {
    await gate;
    await route.fulfill({ json: summary });
  });
  await page.goto("/dashboard");
  await expect(page.locator(".metric-skeleton")).toHaveCount(4);
  await expect(page.getByText("Setup required", { exact: true })).toHaveCount(
    0,
  );
  release();
  await expect(
    page.getByText("Credentials configured", { exact: true }),
  ).toBeVisible();
});
test("failed logout keeps the visible session and allows retry", async ({
  page,
}) => {
  await page.route("**/api/auth/logout", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByText("Sign out could not be confirmed. Please try again."),
  ).toBeVisible();
  await expect(page.locator(".user-chip")).toContainText("Nour Hassan");
  await expect(page).toHaveURL(/dashboard/);
  await page.unroute("**/api/auth/logout");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
});
test("login sends only employee credentials and keeps browser storage empty", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await page.screenshot({
    path: testInfo.outputPath("login-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await expect(
    page.getByRole("button", { name: "Sign in to workspace" }),
  ).toBeDisabled();
  await page.getByLabel("Email or username").fill("nour@example.test");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Hide password" }).click();
  const request = page.waitForRequest((r) =>
    r.url().endsWith("/api/auth/login"),
  );
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  expect((await request).postDataJSON()).toEqual({
    usernameOrEmail: "nour@example.test",
    password: "fixture-password",
  });
  await expect(page).toHaveURL(/dashboard/);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ local: 0, session: 0 });
});
test("unauthorized session returns to sign-in", async ({ page }) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
  await expect(
    page.getByRole("heading", { name: "Good to see you again." }),
  ).toBeVisible();
});
test("non-admin cannot navigate to the team screen", async ({ page }) => {
  await mockApi(page, "User");
  await page.goto("/employees");
  await expect(page).toHaveURL(/dashboard/);
  await expect(
    page.getByRole("link", { name: "Team members", exact: true }),
  ).toHaveCount(0);
});
test("browsing operational views does not mutate records or claim Amazon acceptance", async ({
  page,
}) => {
  const mutations: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/") && r.method() !== "GET")
      mutations.push(r.url());
  });
  await page.goto("/purchase-orders");
  await expect(page.getByText("PO-2026-0148")).toBeVisible();
  await page.goto("/bulk-upload");
  await expect(
    page.getByText("Choose a vendor to see upload history"),
  ).toBeVisible();
  await page.locator("#vendor-selector").selectOption("vendor-0");
  await expect(page.getByText("CATALOG-NOV-01")).toBeVisible();
  await expect(
    page.getByText("Acceptance not verified", { exact: true }),
  ).toBeVisible();
  await page.goto("/employees");
  await expect(page.locator("tbody")).toContainText("Nour Hassan");
  expect(mutations).toEqual([]);
});
test("mobile drawer traps focus, closes on Escape and navigation, and restores scrolling", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(page.locator(".sidebar")).toHaveAttribute("inert", "");
  await page.getByRole("button", { name: "Open navigation" }).click();
  const dialog = page.getByRole("dialog", { name: "Workspace navigation" });
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Pentanela home" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Pentanela home" }),
  ).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("mobile-navigation.png") });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
  expect(
    await page.evaluate(() => document.documentElement.style.overflow),
  ).not.toBe("hidden");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("link", { name: "Vendor accounts", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Vendor accounts." }),
  ).toBeVisible();
  await expect(page.locator("main")).toBeFocused();
  await page.goto("/dashboard");
  await expect(page.locator(".attention-row")).toHaveCount(4);
  await page.screenshot({
    path: testInfo.outputPath("overview-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
});
for (const width of [320, 390, 768, 1024, 1440]) {
  test(
    "responsive layout has no page overflow at " + width + "px",
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        "/login",
        "/dashboard",
        "/vendor-accounts",
        "/integration",
        "/products",
      ]) {
        await page.goto(path);
        await expect(
          page.locator("h1:visible,h2:visible").first(),
        ).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          path,
        ).toBe(true);
      }
    },
  );
}
for (const path of [
  "/login",
  "/dashboard",
  "/vendor-accounts",
  "/integration",
  "/products",
  "/purchase-orders",
  "/employees",
]) {
  test("accessibility checks " + path, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("h1:visible,h2:visible").first()).toBeVisible();
    if (path !== "/login")
      await expect(page.locator("#vendor-selector")).toBeEnabled();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    ).toEqual([]);
  });
}
test("reduced motion disables shimmer and transition effects", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard");
  expect(
    await page
      .locator(".nav-link")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration),
  ).toBe("0s");
});
test("API error can recover through refresh", async ({ page }) => {
  await page.route("**/api/vendor-accounts", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await page.goto("/vendor-accounts");
  await expect(
    page.getByText("Accounts are unavailable", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/vendor-accounts");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(8);
});

test("mobile screens and open drawer pass accessibility checks", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/login", "/dashboard", "/vendor-accounts"]) {
    await page.goto(path);
    await expect(page.locator("h1:visible,h2:visible").first()).toBeVisible();
    if (path !== "/login")
      await expect(page.locator("#vendor-selector")).toBeEnabled();
    let results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
});
test("forbidden records show an access error without a misleading empty state", async ({
  page,
}) => {
  await page.route("**/api/products?**", (route) =>
    route.fulfill({ status: 403, json: {} }),
  );
  await page.goto("/products");
  await expect(
    page.getByText("Your account does not have access to these records."),
  ).toBeVisible();
  await expect(page.getByText("No records to show yet")).toHaveCount(0);
});
test("refreshing accounts keeps the header selector synchronized", async ({
  page,
}) => {
  await page.goto("/vendor-accounts");
  await expect(page.locator("tbody tr")).toHaveCount(8);
  await page.route("**/api/vendor-accounts", (route) =>
    route.fulfill({
      json: [
        ...vendors,
        {
          ...vendors[0],
          id: "new-vendor",
          name: "New test account",
          vendorCode: "NEW01",
        },
      ],
    }),
  );
  await page
    .getByRole("button", { name: "Refresh accounts", exact: true })
    .click();
  await expect(page.locator("#vendor-selector option")).toHaveCount(14);
  await page.getByRole("searchbox").fill("New test account");
  await page.getByRole("button", { name: "Select New test account" }).click();
  await expect(page.locator("#vendor-selector")).toHaveValue("new-vendor");
});

test("skip link focuses content without losing the current page or filters", async ({
  page,
}) => {
  await page.goto("/vendor-accounts");
  await page.getByRole("searchbox").fill("Nile");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("link", { name: "Skip to content" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await expect(page).toHaveURL(/vendor-accounts$/);
  await expect(page.getByRole("searchbox")).toHaveValue("Nile");
});
