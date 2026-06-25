import { useId, useRef } from "react";

interface NumberStepperProps {
  label: string;
  name: string;
  step: number;
  min?: number;
  max?: number;
  precision?: number;
  suffix?: string;
  value?: string | number;
  defaultValue?: string | number;
  onRawChange?: (value: string) => void;
  onValueChange?: (value: number) => void;
  inputRef?: (node: HTMLInputElement | null) => void;
}

function decimalsFor(step: number) {
  const [, decimals = ""] = String(step).split(".");
  return decimals.length;
}

function clamp(value: number, min: number | undefined, max: number | undefined) {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
}

function formatValue(value: number, step: number, precision: number | undefined) {
  const places = precision ?? decimalsFor(step);
  const rounded = places > 0 ? value.toFixed(places) : String(Math.round(value));
  return Object.is(Number(rounded), -0) ? "0" : rounded;
}

export function NumberStepper({
  label,
  name,
  step,
  min,
  max,
  precision,
  suffix,
  value,
  defaultValue = "",
  onRawChange,
  onValueChange,
  inputRef
}: NumberStepperProps) {
  const generatedId = useId();
  const inputId = `${generatedId}-${name}`;
  const localInputRef = useRef<HTMLInputElement | null>(null);
  const controlled = value !== undefined;
  const inputValue = controlled ? String(value) : undefined;

  const setInputRef = (node: HTMLInputElement | null) => {
    localInputRef.current = node;
    inputRef?.(node);
  };

  const emitRawValue = (nextValue: string) => {
    if (!controlled && localInputRef.current) {
      localInputRef.current.value = nextValue;
    }
    onRawChange?.(nextValue);

    const parsed = Number(nextValue);
    if (Number.isFinite(parsed)) {
      onValueChange?.(parsed);
    }
  };

  const stepValue = (direction: -1 | 1) => {
    const rawValue = controlled
      ? inputValue ?? ""
      : localInputRef.current?.value ?? "";
    const current = Number(rawValue);
    const hasCurrent = Number.isFinite(current);
    const base = hasCurrent ? current + direction * step : min ?? 0;
    emitRawValue(formatValue(clamp(base, min, max), step, precision));
  };

  return (
    <div className="number-stepper">
      <label className="number-stepper-label" htmlFor={inputId}>{label}</label>
      <div className="number-stepper-control">
        <button
          type="button"
          className="number-stepper-button"
          aria-label={`${label} znížiť`}
          onClick={() => stepValue(-1)}
        >
          -
        </button>
        <div className="number-stepper-input-wrap">
          <input
            ref={setInputRef}
            id={inputId}
            name={name}
            type="number"
            inputMode="decimal"
            step={step}
            min={min}
            max={max}
            value={inputValue}
            defaultValue={controlled ? undefined : defaultValue}
            onChange={(event) => {
              onRawChange?.(event.currentTarget.value);
              const parsed = Number(event.currentTarget.value);
              if (Number.isFinite(parsed)) {
                onValueChange?.(parsed);
              }
            }}
          />
          {suffix && <span aria-hidden="true">{suffix}</span>}
        </div>
        <button
          type="button"
          className="number-stepper-button"
          aria-label={`${label} zvýšiť`}
          onClick={() => stepValue(1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
