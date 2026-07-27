import { describe, it, expect } from "vitest";
import {
  ACTIONS,
  ACTION_LABELS,
  STANDARD_KEYS,
  DEFAULT_CUSTOM,
  resolve,
  eventKey,
  findConflict,
  isAssignableKey,
  mouseAction,
  type CustomKeys,
} from "./keymap";

describe("eventKey", () => {
  it("한글 IME에서 물리 영문 키(e.code=KeyX)를 소문자 영문자로 보정한다", () => {
    // 두벌식에서 물리 X는 'ㅌ'로 들어오지만 e.code는 KeyX 유지
    expect(eventKey({ key: "ㅌ", code: "KeyX" })).toBe("x");
    expect(eventKey({ key: "Process", code: "KeyX" })).toBe("x");
  });

  it("영문 입력·비영문 키는 e.key를 그대로 둔다", () => {
    expect(eventKey({ key: "x", code: "KeyX" })).toBe("x");
    expect(eventKey({ key: "ArrowRight", code: "ArrowRight" })).toBe("ArrowRight");
    expect(eventKey({ key: ".", code: "Period" })).toBe(".");
  });
});

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

describe("파일 패널 토글 동작", () => {
  it("togglePanel이 동작 목록에 있고 기본 커스텀 키는 '/'", () => {
    expect(ACTIONS).toContain("togglePanel");
    expect(DEFAULT_CUSTOM.togglePanel).toBe("/");
  });

  it("resolve는 togglePanel을 반환하지 않는다(App 전역에서 별도 처리)", () => {
    expect(resolve("/", DEFAULT_CUSTOM, "page")).toBeNull();
    expect(resolve("/", DEFAULT_CUSTOM, "continuous")).toBeNull();
  });

  it("'/'는 예약되어 다른 동작이 못 뺏는다(충돌 감지)", () => {
    expect(findConflict("nextFile", "/", DEFAULT_CUSTOM)).toBe("togglePanel");
  });
});

describe("앱 종료 동작", () => {
  it("quitApp이 동작 목록에 있고 기본 커스텀 키는 'x'", () => {
    expect(ACTIONS).toContain("quitApp");
    expect(DEFAULT_CUSTOM.quitApp).toBe("x");
  });

  it("resolve는 quitApp을 반환하지 않는다(App 전역에서 별도 처리)", () => {
    expect(resolve("x", DEFAULT_CUSTOM, "page")).toBeNull();
    expect(resolve("x", DEFAULT_CUSTOM, "continuous")).toBeNull();
  });

  it("'x'는 예약되어 다른 동작이 못 뺏는다(충돌 감지)", () => {
    expect(findConflict("nextFile", "x", DEFAULT_CUSTOM)).toBe("quitApp");
  });
});

describe("보기 모드 전환 동작", () => {
  it("modePage·modeContinuous가 동작 목록에 있고 기본 커스텀 키는 '1'/'2'", () => {
    expect(ACTIONS).toContain("modePage");
    expect(ACTIONS).toContain("modeContinuous");
    expect(DEFAULT_CUSTOM.modePage).toBe("1");
    expect(DEFAULT_CUSTOM.modeContinuous).toBe("2");
  });

  it("표준 키는 없다(커스텀 키로만 동작, 재지정 가능)", () => {
    expect(STANDARD_KEYS.modePage).toEqual([]);
    expect(STANDARD_KEYS.modeContinuous).toEqual([]);
  });

  it("설정 표에 쓰는 라벨", () => {
    expect(ACTION_LABELS.modePage).toBe("한장 보기");
    expect(ACTION_LABELS.modeContinuous).toBe("연속 보기");
  });

  it("두 보기 모드 모두에서 해석된다", () => {
    expect(resolve("1", DEFAULT_CUSTOM, "page")).toBe("modePage");
    expect(resolve("1", DEFAULT_CUSTOM, "continuous")).toBe("modePage");
    expect(resolve("2", DEFAULT_CUSTOM, "page")).toBe("modeContinuous");
    expect(resolve("2", DEFAULT_CUSTOM, "continuous")).toBe("modeContinuous");
  });

  it("재지정한 키로 해석되고 기본 키는 죽는다", () => {
    const custom: CustomKeys = { ...DEFAULT_CUSTOM, modePage: "q" };
    expect(resolve("q", custom, "continuous")).toBe("modePage");
    expect(resolve("1", custom, "continuous")).toBeNull();
  });

  it("'1'/'2'는 예약되어 다른 동작이 못 뺏는다(충돌 감지)", () => {
    expect(findConflict("nextFile", "1", DEFAULT_CUSTOM)).toBe("modePage");
    expect(findConflict("nextFile", "2", DEFAULT_CUSTOM)).toBe("modeContinuous");
  });
});

describe("마우스 버튼 동작", () => {
  it("뒤로(3)·앞으로(4) 버튼이 이전/다음 파일로 매핑된다", () => {
    expect(mouseAction(3)).toBe("prevFile");
    expect(mouseAction(4)).toBe("nextFile");
  });

  it("왼쪽·가운데·오른쪽 클릭은 아무 동작도 아니다", () => {
    expect(mouseAction(0)).toBeNull();
    expect(mouseAction(1)).toBeNull();
    expect(mouseAction(2)).toBeNull();
  });

  it("정의되지 않은 버튼 번호는 null", () => {
    expect(mouseAction(5)).toBeNull();
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
