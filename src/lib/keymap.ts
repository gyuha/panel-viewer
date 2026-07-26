// 읽기 동작 단축키 로직. 각 동작은 항상 동작하는 표준 키(고정)와 사용자 커스텀 키 1개를 가진다.
import type { ViewMode } from "./nav";

export type Action =
  | "nextPage"
  | "prevPage"
  | "firstPage"
  | "lastPage"
  | "nextFile"
  | "prevFile"
  | "modePage"
  | "modeContinuous"
  | "togglePanel"
  | "quitApp";

export const ACTIONS: Action[] = [
  "nextPage",
  "prevPage",
  "firstPage",
  "lastPage",
  "nextFile",
  "prevFile",
  "modePage",
  "modeContinuous",
  "togglePanel",
  "quitApp",
];

export const ACTION_LABELS: Record<Action, string> = {
  nextPage: "다음 페이지",
  prevPage: "이전 페이지",
  firstPage: "처음 페이지",
  lastPage: "마지막 페이지",
  nextFile: "다음 파일",
  prevFile: "이전 파일",
  modePage: "한장 보기",
  modeContinuous: "연속 보기",
  togglePanel: "파일 패널 토글",
  quitApp: "앱 종료",
};

/** 항상 동작하는 표준 키(재지정 불가). KeyboardEvent.key 값. */
export const STANDARD_KEYS: Record<Action, string[]> = {
  nextPage: ["ArrowRight", " ", "PageDown"],
  prevPage: ["ArrowLeft", "PageUp"],
  firstPage: ["Home"],
  lastPage: ["End"],
  nextFile: [],
  prevFile: [],
  modePage: [],
  modeContinuous: [],
  togglePanel: [],
  quitApp: [],
};

/** 동작 → 커스텀 키("" = 없음). */
export type CustomKeys = Record<Action, string>;

export const DEFAULT_CUSTOM: CustomKeys = {
  nextPage: "",
  prevPage: "",
  firstPage: "",
  lastPage: "",
  nextFile: ".",
  prevFile: ",",
  modePage: "1",
  modeContinuous: "2",
  togglePanel: "/",
  quitApp: "x",
};

const PAGE_ACTIONS: Action[] = ["nextPage", "prevPage", "firstPage", "lastPage"];
const FILE_ACTIONS: Action[] = ["nextFile", "prevFile"];
const MODE_ACTIONS: Action[] = ["modePage", "modeContinuous"];

// 페이지 동작은 한장 모드에서만, 파일 이동과 보기 모드 전환은 두 모드 모두 유효.
function actionsFor(mode: ViewMode): Action[] {
  return mode === "continuous"
    ? [...FILE_ACTIONS, ...MODE_ACTIONS]
    : [...PAGE_ACTIONS, ...FILE_ACTIONS, ...MODE_ACTIONS];
}

/**
 * 단축키 비교용 키를 정규화한다. 한글 등 IME 레이아웃에서 물리 영문 키가 자모로 들어오는
 * 문제(예: 물리 X → "ㅌ")를 물리 키 위치(e.code)로 보정한다.
 * e.key가 ASCII 영문자가 아니고 e.code가 "KeyA"~"KeyZ"면 대응 소문자 영문자를, 그 외엔 e.key를 그대로 돌려준다.
 */
export function eventKey(e: { key: string; code: string }): string {
  const isAsciiLetter = e.key.length === 1 && /[a-zA-Z]/.test(e.key);
  if (!isAsciiLetter && e.code.length === 4 && e.code.startsWith("Key")) {
    const c = e.code.charCodeAt(3);
    if (c >= 65 && c <= 90) return e.code[3].toLowerCase();
  }
  return e.key;
}

/** 키를 사람이 읽는 라벨로(설정 표·툴팁 공용). */
export function keyLabel(k: string): string {
  const map: Record<string, string> = {
    " ": "Space",
    ArrowRight: "→",
    ArrowLeft: "←",
    ArrowUp: "↑",
    ArrowDown: "↓",
    PageUp: "PageUp",
    PageDown: "PageDown",
  };
  return map[k] ?? k;
}

/** 버튼 툴팁에 현재 지정된 커스텀 키를 붙인다(지정 안 됐으면 접미사 없음). */
export function withKey(title: string, key: string): string {
  return key ? `${title} (${keyLabel(key)})` : title;
}

/** 눌린 키를 동작으로 해석한다(표준 키 + 커스텀 키, 모드별 유효 동작만). 없으면 null. */
export function resolve(key: string, custom: CustomKeys, mode: ViewMode): Action | null {
  for (const a of actionsFor(mode)) {
    if (STANDARD_KEYS[a].includes(key)) return a;
    if (custom[a] !== "" && custom[a] === key) return a;
  }
  return null;
}

/**
 * key를 action의 커스텀 키로 지정할 때 충돌하는 대상 동작을 돌려준다(없으면 null).
 * 표준 키(모든 동작)와 다른 동작의 커스텀 키를 예약된 것으로 본다.
 */
export function findConflict(action: Action, key: string, custom: CustomKeys): Action | null {
  for (const a of ACTIONS) {
    if (STANDARD_KEYS[a].includes(key)) return a;
  }
  for (const a of ACTIONS) {
    if (a === action) continue;
    if (custom[a] !== "" && custom[a] === key) return a;
  }
  return null;
}

/** 커스텀 키로 지정할 수 있는 키인지(조합키·수식 키·Esc 제외, 단일 키만). */
export function isAssignableKey(e: {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}): boolean {
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  if (["Shift", "Control", "Alt", "Meta", "CapsLock", "Tab", "Escape"].includes(e.key)) {
    return false;
  }
  return true;
}
