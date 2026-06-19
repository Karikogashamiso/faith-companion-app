import { test, expect } from "@playwright/test";

// Smoke coverage for the launch-critical public surfaces. Auth/AI/payment flows
// that need real backend state are intentionally out of scope here.

test("landing page renders the hero and a primary CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /understand the bible/i })).toBeVisible();
  await expect(page.getByText(/citation-locked/i).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /start free/i }).first()).toBeVisible();
});

test("pricing section shows free and companion tiers", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/the bible is free/i)).toBeVisible();
  await expect(page.getByText(/save 33%/i)).toBeVisible();
});

test("auth page loads with an email field", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByPlaceholder(/you@example\.com/i)).toBeVisible();
});

test("robots.txt and sitemap.xml are served", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain("User-agent");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain("<urlset");
});

test("manifest is valid JSON with icons", async ({ request }) => {
  const res = await request.get("/manifest.json");
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  expect(json.name).toContain("Faith Companion");
  expect(Array.isArray(json.icons)).toBeTruthy();
});
