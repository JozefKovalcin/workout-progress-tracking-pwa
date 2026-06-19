/// <reference types="@testing-library/jest-dom" />

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";

describe("App demo mode", () => {
  beforeEach(() => localStorage.clear());

  it("renders the navigation and Today screen", async () => {
    render(<App initialMode="demo" now={new Date(2026, 5, 19)} />);

    expect(await screen.findByRole("heading", { name: "Dnes" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Dnes" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Tréning" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Progress" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Nastavenia" })).toHaveLength(2);
  });

  it("does not offer Accept when the recommendation is insufficient", async () => {
    render(<App initialMode="demo" now={new Date(2026, 5, 19)} />);

    expect(await screen.findByText(/Kalibrácia deň 1\/14/)).toBeVisible();
    expect(screen.getByText(/Najprv dokonči 14-dňový blok/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Prijať" })).not.toBeInTheDocument();
  });
});
