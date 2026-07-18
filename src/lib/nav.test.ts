import { describe, it, expect } from "vitest";
import { clampPage, nextPage, prevPage, arrowAdvance } from "./nav";

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

describe("direction-aware arrow navigation", () => {
  it("LTR: right = next, left = prev", () => {
    expect(arrowAdvance("right", 0, 5, "ltr")).toBe(1);
    expect(arrowAdvance("left", 2, 5, "ltr")).toBe(1);
  });

  it("RTL: left = next, right = prev", () => {
    expect(arrowAdvance("left", 0, 5, "rtl")).toBe(1);
    expect(arrowAdvance("right", 2, 5, "rtl")).toBe(1);
  });

  it("stops at bounds in both modes", () => {
    expect(arrowAdvance("right", 4, 5, "ltr")).toBe(4); // 마지막에서 다음 없음
    expect(arrowAdvance("left", 0, 5, "ltr")).toBe(0); // 처음에서 이전 없음
    expect(arrowAdvance("left", 4, 5, "rtl")).toBe(4);
    expect(arrowAdvance("right", 0, 5, "rtl")).toBe(0);
  });
});
