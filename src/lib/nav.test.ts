import { describe, it, expect } from "vitest";
import {
  clampPage,
  nextPage,
  prevPage,
  wheelTurn,
  seamlessTurn,
  scrollTopForPage,
} from "./nav";

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

describe("seamlessTurn (파일 이어보기 경계 판단)", () => {
  it("경계 안에서는 일반 페이지 이동", () => {
    expect(seamlessTurn(1, 5, 1, true, true, true)).toEqual({ kind: "page", page: 2 });
    expect(seamlessTurn(3, 5, -1, true, true, true)).toEqual({ kind: "page", page: 2 });
  });

  it("마지막 페이지에서 다음 + 이어보기 + 다음 파일 있으면 파일 전환(dir 1)", () => {
    expect(seamlessTurn(4, 5, 1, true, true, true)).toEqual({ kind: "file", dir: 1 });
  });

  it("첫 페이지에서 이전 + 이어보기 + 이전 파일 있으면 파일 전환(dir -1)", () => {
    expect(seamlessTurn(0, 5, -1, true, true, true)).toEqual({ kind: "file", dir: -1 });
  });

  it("이어보기 꺼져 있으면 경계에서 아무 일 없음", () => {
    expect(seamlessTurn(4, 5, 1, false, true, true)).toEqual({ kind: "none" });
    expect(seamlessTurn(0, 5, -1, false, true, true)).toEqual({ kind: "none" });
  });

  it("이어보기지만 인접 파일 없으면 아무 일 없음", () => {
    expect(seamlessTurn(4, 5, 1, true, true, false)).toEqual({ kind: "none" });
    expect(seamlessTurn(0, 5, -1, true, false, true)).toEqual({ kind: "none" });
  });
});

describe("scrollTopForPage (연속 모드 스크롤 목표)", () => {
  it("아래에 있는 페이지로 내려간다", () => {
    // 컨테이너 상단 100, 대상 페이지 상단 700 → 600px 아래로
    expect(scrollTopForPage(0, 100, 700)).toBe(600);
    expect(scrollTopForPage(2000, 100, 700)).toBe(2600);
  });

  it("위에 있는 페이지로 올라간다", () => {
    // 대상이 컨테이너보다 위(음수 방향) → scrollTop 감소
    expect(scrollTopForPage(2000, 100, -500)).toBe(1400);
  });

  it("이미 맨 위에 걸린 페이지면 그대로", () => {
    expect(scrollTopForPage(1500, 100, 100)).toBe(1500);
  });

  it("음수로 내려가지 않는다(맨 위에서 클램프)", () => {
    expect(scrollTopForPage(0, 100, -500)).toBe(0);
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
