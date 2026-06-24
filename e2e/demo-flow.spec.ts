import { expect, test } from "@playwright/test";

test("demo flow saves daily data, training, progress, and export", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Lokálny demo režim" }).click();
  await expect(page.getByRole("heading", { name: "Dnes" })).toBeVisible();

  await page.getByLabel("Hmotnosť (kg)").fill("81.8");
  await page.getByLabel("Pás (cm)").fill("82");
  await page.getByLabel("Kalórie").fill("2850");
  await page.getByLabel("Spánok 1–10").fill("8");
  await page.getByLabel("Pripravenosť 1–10").fill("8");

  const trainingQuality = page.getByLabel("Kvalita tréningu 1–10");
  if (await trainingQuality.count()) {
    await trainingQuality.fill("8");
  }

  await page.getByRole("button", { name: "Uložiť deň" }).click();
  await expect(page.getByText("Deň uložený.")).toBeVisible();

  await page.getByRole("button", { name: "Tréning" }).first().click();
  const switchToTraining = page.getByRole("button", { name: "Prepnúť dnešok na tréning" });
  if (await switchToTraining.count()) {
    await switchToTraining.click();
  }

  await expect(page.locator(".exercise-card").first()).toBeVisible();
  await page.getByLabel("Séria 1 kg").first().fill("100");
  await page.getByLabel("Séria 1 opakovania").first().fill("6");
  await page.getByLabel("Séria 1 RIR").first().fill("2");
  await page.getByLabel("Séria 2 kg").first().fill("90");
  await page.getByLabel("Séria 2 opakovania").first().fill("10");
  await page.getByLabel("Séria 2 RIR").first().fill("1");
  await expect(page.getByText(/Live e1RM/).first()).toBeVisible();
  await page.getByRole("button", { name: "Uložiť 2 série" }).first().click();
  await expect(page.getByText("Tréning uložený.")).toBeVisible();

  await page.getByRole("button", { name: "Progress" }).first().click();
  await expect(page.getByText("Trend hmotnosti")).toBeVisible();
  await expect(page.getByText("Aspoň 2 merania zobrazia trend.").first()).toBeVisible();

  await page.getByRole("button", { name: "Nastavenia" }).first().click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportovať JSON" }).click();
  await expect((await download).suggestedFilename()).toContain("lean-bulk-export");
});
