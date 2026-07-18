import { describe, it, expect } from "vitest";
import { clampPage, nextPage, prevPage } from "./nav";

describe("page navigation", () => {
  it("clamps within bounds", () => {
    expect(clampPage(-3, 10)).toBe(0);
    expect(clampPage(5, 10)).toBe(5);
    expect(clampPage(99, 10)).toBe(9);
    expect(clampPage(3, 0)).toBe(0);
  });

  it("advances to next, stopping at the last page", () => {
    expect(nextPage(0, 5)).toBe(1);
    expect(nextPage(4, 5)).toBe(4);
  });

  it("goes to previous, stopping at the first page", () => {
    expect(prevPage(3, 5)).toBe(2);
    expect(prevPage(0, 5)).toBe(0);
  });
});
