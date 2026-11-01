import { describe, expect, it } from "vitest";
import { safeNext } from "./home";

describe("login return paths", () => {
  it.each(["/app", "/app/transfers/new?from=dashboard", "/business#approvals"])("preserves local path %s", (path) => {
    expect(safeNext(path)).toBe(path);
  });
  it.each([null, "https://example.com", "//example.com", "/\\example.com", "/\t/example.com", "/\n/example.com", " /app", "/app\u0000"])("rejects unsafe path %s", (path) => {
    expect(safeNext(path)).toBeNull();
  });
});
