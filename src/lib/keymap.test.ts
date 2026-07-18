import { describe, it, expect } from "vitest";
import {
  DEFAULT_CUSTOM,
  resolve,
  findConflict,
  isAssignableKey,
  type CustomKeys,
} from "./keymap";

describe("resolve", () => {
  it("표준 키를 동작으로 해석한다 (한장 모드)", () => {
    expect(resolve("ArrowRight", DEFAULT_CUSTOM, "page")).toBe("nextPage");
    expect(resolve(" ", DEFAULT_CUSTOM, "page")).toBe("nextPage");
    expect(resolve("ArrowLeft", DEFAULT_CUSTOM, "page")).toBe("prevPage");
    expect(resolve("Home", DEFAULT_CUSTOM, "page")).toBe("firstPage");
    expect(resolve("End", DEFAULT_CUSTOM, "page")).toBe("lastPage");
  });

  it("파일 이동 기본 커스텀 키 '.'/','를 해석한다 (두 모드 모두)", () => {
    expect(resolve(".", DEFAULT_CUSTOM, "page")).toBe("nextFile");
    expect(resolve(",", DEFAULT_CUSTOM, "page")).toBe("prevFile");
    expect(resolve(".", DEFAULT_CUSTOM, "continuous")).toBe("nextFile");
    expect(resolve(",", DEFAULT_CUSTOM, "continuous")).toBe("prevFile");
  });

  it("연속 모드에서는 페이지 동작 키를 무시한다(네이티브 스크롤 보존)", () => {
    expect(resolve("ArrowRight", DEFAULT_CUSTOM, "continuous")).toBeNull();
    expect(resolve("Home", DEFAULT_CUSTOM, "continuous")).toBeNull();
  });

  it("커스텀 키를 해석한다", () => {
    const custom: CustomKeys = { ...DEFAULT_CUSTOM, nextPage: "d" };
    expect(resolve("d", custom, "page")).toBe("nextPage");
  });

  it("매핑되지 않은 키는 null", () => {
    expect(resolve("z", DEFAULT_CUSTOM, "page")).toBeNull();
  });
});

describe("findConflict", () => {
  it("표준 키와 겹치면 그 동작을 돌려준다", () => {
    expect(findConflict("nextFile", "ArrowRight", DEFAULT_CUSTOM)).toBe("nextPage");
  });

  it("다른 동작의 커스텀 키와 겹치면 그 동작을 돌려준다", () => {
    expect(findConflict("nextFile", ",", DEFAULT_CUSTOM)).toBe("prevFile");
  });

  it("자기 자신의 현재 커스텀 키로 재지정하는 건 충돌 아님", () => {
    expect(findConflict("nextFile", ".", DEFAULT_CUSTOM)).toBeNull();
  });

  it("아무도 안 쓰는 키는 충돌 없음", () => {
    expect(findConflict("nextFile", "z", DEFAULT_CUSTOM)).toBeNull();
  });
});

describe("isAssignableKey", () => {
  it("단일 키는 지정 가능", () => {
    expect(isAssignableKey({ key: ",", ctrlKey: false, altKey: false, metaKey: false })).toBe(true);
    expect(isAssignableKey({ key: "d", ctrlKey: false, altKey: false, metaKey: false })).toBe(true);
  });

  it("조합키(Ctrl/Alt/Meta)는 지정 불가", () => {
    expect(isAssignableKey({ key: "d", ctrlKey: true, altKey: false, metaKey: false })).toBe(false);
    expect(isAssignableKey({ key: "d", ctrlKey: false, altKey: false, metaKey: true })).toBe(false);
  });

  it("수식 키 자체와 Esc는 지정 불가", () => {
    expect(isAssignableKey({ key: "Shift", ctrlKey: false, altKey: false, metaKey: false })).toBe(false);
    expect(isAssignableKey({ key: "Escape", ctrlKey: false, altKey: false, metaKey: false })).toBe(false);
  });
});
