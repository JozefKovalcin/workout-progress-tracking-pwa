import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface HostingHeader {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

const config = JSON.parse(
  readFileSync("firebase.json", "utf8")
) as {
  hosting: {
    headers?: HostingHeader[];
  };
};

function cacheControl(source: string) {
  return config.hosting.headers
    ?.find((rule) => rule.source === source)
    ?.headers.find((header) => header.key === "Cache-Control")
    ?.value;
}

describe("Firebase Hosting cache configuration", () => {
  it.each(["/", "/index.html", "/sw.js", "/registerSW.js"])(
    "always revalidates %s",
    (source) => {
      expect(cacheControl(source)).toBe("no-cache, no-store, must-revalidate");
    }
  );

  it("keeps hashed application assets immutable", () => {
    expect(cacheControl("/assets/**")).toBe(
      "public, max-age=31536000, immutable"
    );
  });
});
