import { describe, it, expect } from "vitest";
import { clampPage, nextPage, prevPage, wheelTurn } from "./nav";

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

describe("wheel page turn (cooldown gating)", () => {
  it("does not turn while within the cooldown", () => {
    // now-lastTurnAt = 50 < 200 → 무시
    expect(wheelTurn(100, 100, 50, 200)).toEqual({ turn: false, dir: 1 });
  });

  it("turns to next page on downward wheel after cooldown", () => {
    // now-lastTurnAt = 250 >= 200, deltaY>0 → 다음
    expect(wheelTurn(100, 300, 50, 200)).toEqual({ turn: true, dir: 1 });
  });

  it("turns to previous page on upward wheel after cooldown", () => {
    expect(wheelTurn(-100, 300, 50, 200)).toEqual({ turn: true, dir: -1 });
  });

  it("turns exactly at the cooldown boundary (not strictly within)", () => {
    // now-lastTurnAt = 200, 200 < 200 false → 전환됨
    expect(wheelTurn(100, 200, 0, 200)).toEqual({ turn: true, dir: 1 });
  });

  it("never turns on a zero-delta wheel event, even past cooldown", () => {
    expect(wheelTurn(0, 1000, 0, 200)).toEqual({ turn: false, dir: 1 });
  });
});
