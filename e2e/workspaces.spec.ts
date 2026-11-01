import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email = "maya@atlas.demo", next = "/app") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("atlas-demo-2026");
  await page.getByRole("button", { name: "Sign in to Atlas" }).click();
  await expect(page).toHaveURL(new RegExp(`${next}$`));
}

test("login rejects incorrect input and logout invalidates the previous session", async ({ page, context }) => {
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill("maya@atlas.demo");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in to Atlas" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Email or password is incorrect" })).toBeVisible();
  await page.getByRole("button", { name: "Fill personal demo credentials" }).click();
  await page.getByRole("button", { name: "Sign in to Atlas" }).click();
  await expect(page).toHaveURL(/\/app$/);
  const session = (await context.cookies()).find((cookie) => cookie.name === "atlas_session");
  expect(session).toBeDefined();
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: /Sign out/ }).click();
  await expect(page).toHaveURL(/\/login$/);
  await context.addCookies([session!]);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("personal pages render and card freeze controls persist", async ({ page }) => {
  await login(page);
  for (const route of ["accounts", "transactions", "transfers", "transfers/new", "fx", "cards", "budgets", "goals", "bills", "insights", "beneficiaries", "settings"]) {
    const response = await page.goto(`/app/${route}`);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
  }
  await page.goto("/app/cards");
  await page.getByRole("button", { name: "Freeze", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Unfreeze", exact: true }).first()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Unfreeze", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Freeze", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Limits", exact: true }).first().click();
  await page.getByLabel("Monthly USD", { exact: true }).fill("1000");
  await page.getByLabel("Per txn USD", { exact: true }).fill("1500");
  await page.getByRole("button", { name: "Save limits" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Per-transaction limit cannot exceed the monthly limit" })).toBeVisible();
  await page.getByLabel("Per txn USD", { exact: true }).fill("250");
  await page.getByRole("button", { name: "Save limits" }).click();
  await expect(page.getByText("Card limits updated.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Limits", exact: true }).first().click();
  await expect(page.getByLabel("Monthly USD", { exact: true })).toHaveValue("1000.00");
  await expect(page.getByLabel("Per txn USD", { exact: true })).toHaveValue("250.00");
});

test("account details show metadata for every owned account and reject other accounts", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page);
  for (const [id, name, country] of [
    ["acc_maya_usd", "Everyday USD", "US"],
    ["acc_maya_eur", "Euro travel", "IE"],
    ["acc_maya_gbp", "London GBP", "GB"],
    ["acc_maya_savings", "Reserve savings", "US"],
    ["acc_maya_kyoto", "Kyoto 2027", "US"],
  ]) {
    const response = await page.goto(`/app/accounts/${id}`);
    expect(response?.status(), id).toBe(200);
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    const details = page.locator("dl").filter({ hasText: "Account number" });
    await expect(details.locator("div").filter({ has: page.locator("dt", { hasText: /^Country$/ }) }).locator("dd")).toHaveText(country);
    await expect(details.locator("div").filter({ has: page.locator("dt", { hasText: /^Opened$/ }) }).locator("dd")).not.toHaveText(/Invalid|^$/);
  }
  expect(errors).toEqual([]);
  for (const id of ["acc_alex_usd", "acc_missing"]) {
    expect((await page.goto(`/app/accounts/${id}`))?.status()).toBe(404);
  }
});

test("business workspace pages render for the business owner", async ({ page }) => {
  await login(page, "jonas@atlas.demo", "/business");
  for (const route of ["invoices", "bills", "vendors", "approvals", "expenses", "cards", "team", "reports", "developers"]) {
    const response = await page.goto(`/business/${route}`);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
  }
});

test("operations pages render for staff and reject a customer", async ({ page }) => {
  await login(page, "admin@atlas.demo", "/ops");
  for (const route of ["customers", "support", "risk", "compliance", "reconciliation", "ledger", "audit", "integrations", "health", "permissions"]) {
    const response = await page.goto(`/ops/${route}`);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
  }
  await page.goto("/ops/integrations");
  const failureForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Fail payout", exact: true }) }).first();
  await failureForm.getByLabel("Failure reason").fill("Synthetic provider rejects payout");
  await failureForm.getByLabel("Authorization PIN").fill("246810");
  page.once("dialog", (dialog) => dialog.accept());
  await failureForm.getByRole("button", { name: "Fail payout", exact: true }).click();
  await expect(page.getByText("Payout failed and held funds were released.", { exact: true })).toBeVisible();
  await page.context().clearCookies();
  await login(page);
  await page.goto("/ops");
  await expect(page).toHaveURL(/\/app\?denied=ops$/);
});

