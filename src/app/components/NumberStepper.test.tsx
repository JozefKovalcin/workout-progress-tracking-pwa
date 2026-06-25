/// <reference types="@testing-library/jest-dom" />

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NumberStepper } from "./NumberStepper";

describe("NumberStepper", () => {
  it("increments and decrements an uncontrolled decimal form value", () => {
    render(
      <form aria-label="daily form">
        <NumberStepper
          label="Hmotnosť (kg)"
          name="weightKg"
          defaultValue={81.4}
          step={0.1}
          min={30}
          max={300}
          precision={1}
          suffix="kg"
        />
      </form>
    );

    fireEvent.click(screen.getByRole("button", { name: "Hmotnosť (kg) zvýšiť" }));
    expect(screen.getByLabelText("Hmotnosť (kg)")).toHaveValue(81.5);

    fireEvent.click(screen.getByRole("button", { name: "Hmotnosť (kg) znížiť" }));
    fireEvent.click(screen.getByRole("button", { name: "Hmotnosť (kg) znížiť" }));
    expect(screen.getByLabelText("Hmotnosť (kg)")).toHaveValue(81.3);

    const form = screen.getByRole("form", { name: "daily form" }) as HTMLFormElement;
    expect(new FormData(form).get("weightKg")).toBe("81.3");
  });

  it("keeps manual typing and keyboard input on the native input", () => {
    render(
      <NumberStepper
        label="Kalórie"
        name="calories"
        defaultValue=""
        step={50}
        min={0}
        max={10000}
        suffix="kcal"
      />
    );

    const input = screen.getByLabelText("Kalórie");
    fireEvent.change(input, { target: { value: "2875" } });
    fireEvent.keyDown(input, { key: "ArrowUp" });

    expect(input).toHaveValue(2875);
  });

  it("supports controlled values for live training forms", () => {
    const onRawChange = vi.fn();
    render(
      <NumberStepper
        label="Séria 1 RIR"
        name="rir1"
        value="1.5"
        onRawChange={onRawChange}
        step={0.5}
        min={0}
        max={10}
        precision={1}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Séria 1 RIR zvýšiť" }));

    expect(onRawChange).toHaveBeenCalledWith("2.0");
  });
});
