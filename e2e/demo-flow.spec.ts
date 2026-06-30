import { expect, test } from "@playwright/test";

async function freezeDate(page: import("@playwright/test").Page, isoDate: string) {
  await page.addInitScript({
    content: `
      (() => {
        const fixedNow = new Date("${isoDate}T10:00:00.000Z").valueOf();
        const RealDate = Date;
        class FixedDate extends RealDate {
          constructor(...args) {
            if (args.length === 0) {
              super(fixedNow);
            } else {
              super(...args);
            }
          }

          static now() {
            return fixedNow;
          }
        }
        window.Date = FixedDate;
      })();
    `
  });
}

test("demo flow saves daily data, training, progress, and export", async ({ page }) => {
  const fillPageNumber = async (name: string | RegExp, value: string) => {
    await page.getByRole("spinbutton", { name }).fill(value);
  };

  await freezeDate(page, "2026-06-19");

  await page.goto("/");

  await page.getByRole("button", { name: "Lokálny demo režim" }).click();
  await expect(page.getByRole("heading", { name: "Dnes" })).toBeVisible();

  await fillPageNumber("Hmotnosť (kg)", "81.8");
  await fillPageNumber("Pás (cm)", "82");
  await fillPageNumber("Kalórie", "2850");
  await fillPageNumber("Spánok 1–10", "8");
  await fillPageNumber("Pripravenosť 1–10", "8");

  const trainingQuality = page.getByRole("spinbutton", { name: "Kvalita tréningu 1–10" });
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

  const exerciseCard = page.locator(".exercise-card").first();
  const fillExerciseNumber = async (name: string, value: string) => {
    await exerciseCard.getByRole("spinbutton", { name }).fill(value);
  };
  await expect(exerciseCard).toBeVisible();
  await fillExerciseNumber("Séria 1 kg", "100");
  await fillExerciseNumber("Séria 1 opakovania", "6");
  await fillExerciseNumber("Séria 1 RIR", "2");
  await fillExerciseNumber("Séria 2 kg", "90");
  await fillExerciseNumber("Séria 2 opakovania", "10");
  await fillExerciseNumber("Séria 2 RIR", "1");
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
  await page.context().close();
});

test("training form keeps working-set inputs readable in wide two-column layout", async ({ page }) => {
  await page.setViewportSize({ width: 2048, height: 1200 });
  await freezeDate(page, "2026-06-19");

  await page.goto("/");
  await page.getByRole("button", { name: "Lokálny demo režim" }).click();
  await page.getByRole("button", { name: "Tréning" }).first().click();

  const exerciseCard = page.locator(".exercise-card").first();
  await expect(exerciseCard).toBeVisible();

  const workingSet = exerciseCard.locator(".working-set").first();
  const workingSetBox = await workingSet.boundingBox();
  expect(workingSetBox?.width).toBeGreaterThanOrEqual(520);

  const firstSetControls = workingSet.locator(".number-stepper-control");
  await expect(firstSetControls).toHaveCount(3);
});
