// 읽기 동작 단축키 로직. 각 동작은 항상 동작하는 표준 키(고정)와 사용자 커스텀 키 1개를 가진다.
import type { ViewMode } from "./nav";

export type Action =
  | "nextPage"
  | "prevPage"
  | "firstPage"
  | "lastPage"
  | "nextFile"
  | "prevFile";

export const ACTIONS: Action[] = [
  "nextPage",
  "prevPage",
  "firstPage",
  "lastPage",
  "nextFile",
  "prevFile",
];

export const ACTION_LABELS: Record<Action, string> = {
  nextPage: "다음 페이지",
  prevPage: "이전 페이지",
  firstPage: "처음 페이지",
  lastPage: "마지막 페이지",
  nextFile: "다음 파일",
  prevFile: "이전 파일",
};

/** 항상 동작하는 표준 키(재지정 불가). KeyboardEvent.key 값. */
export const STANDARD_KEYS: Record<Action, string[]> = {
  nextPage: ["ArrowRight", " ", "PageDown"],
  prevPage: ["ArrowLeft", "PageUp"],
  firstPage: ["Home"],
  lastPage: ["End"],
  nextFile: [],
  prevFile: [],
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
};

const PAGE_ACTIONS: Action[] = ["nextPage", "prevPage", "firstPage", "lastPage"];
const FILE_ACTIONS: Action[] = ["nextFile", "prevFile"];

// 페이지 동작은 한장 모드에서만, 파일 동작은 두 모드 모두 유효.
function actionsFor(mode: ViewMode): Action[] {
  return mode === "continuous" ? FILE_ACTIONS : [...PAGE_ACTIONS, ...FILE_ACTIONS];
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
