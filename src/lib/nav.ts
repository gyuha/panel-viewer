// 페이지 내비게이션 순수 로직. 보기 모드는 한 장(page)과 연속 스크롤(continuous) 두 가지.

export type ViewMode = "page" | "continuous";

/** page를 [0, count-1]로 클램프한다. count가 0이면 0. */
export function clampPage(page: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(page, count - 1));
}

/** 다음 페이지(마지막에서 멈춤). */
export function nextPage(page: number, count: number): number {
  return clampPage(page + 1, count);
}

/** 이전 페이지(처음에서 멈춤). */
export function prevPage(page: number, count: number): number {
  return clampPage(page - 1, count);
}

/**
 * 스크롤 컨테이너를 대상 페이지가 맨 위에 오도록 옮길 때의 새 scrollTop.
 * 좌표는 둘 다 getBoundingClientRect().top(뷰포트 기준)을 넣는다.
 *
 * offsetTop을 쓰지 않는 이유: .continuous에는 position 지정이 없어 자식 .cont-page의
 * offsetParent가 이 컨테이너가 아니다. offsetTop은 엉뚱한 조상 기준 값이라 조용히 틀린다.
 */
export function scrollTopForPage(
  curScrollTop: number,
  containerTop: number,
  pageTop: number,
): number {
  return Math.max(0, curScrollTop + (pageTop - containerTop));
}

export interface WheelTurn {
  /** 이번 휠 입력으로 페이지를 넘길지 여부. */
  turn: boolean;
  /** 방향. 1=다음 페이지(휠 아래), -1=이전 페이지(휠 위). turn이 false면 무의미. */
  dir: -1 | 1;
}

/**
 * 마우스 휠 입력을 한 번의 페이지 전환으로 변환한다(쿨다운 게이팅).
 * 직전 전환(lastTurnAt)에서 cooldownMs가 지나지 않았거나 deltaY가 0이면 넘기지 않는다.
 * 트랙패드가 쏟아내는 작은 delta 무리를 한 제스처=한 번으로 억제하기 위한 것.
 */
export function wheelTurn(
  deltaY: number,
  now: number,
  lastTurnAt: number,
  cooldownMs: number,
): WheelTurn {
  if (deltaY === 0 || now - lastTurnAt < cooldownMs) {
    return { turn: false, dir: 1 };
  }
  return { turn: true, dir: deltaY > 0 ? 1 : -1 };
}

/** 파일 이어보기 경계 판단 결과. */
export type SeamlessResult =
  | { kind: "page"; page: number } // 파일 안에서 일반 페이지 이동
  | { kind: "file"; dir: -1 | 1 } // 인접 파일로 전환(1=다음, -1=이전)
  | { kind: "none" }; // 경계 + 이어보기 불가 → 아무 일 없음

/**
 * dir(1=다음, -1=이전) 방향으로 넘길 때, 파일 안 이동인지 인접 파일 전환인지 판단한다.
 * 경계가 아니면 page 이동, 경계이고 이어보기가 켜져 있고 인접 파일이 있으면 file 전환.
 */
export function seamlessTurn(
  page: number,
  pageCount: number,
  dir: -1 | 1,
  seamless: boolean,
  hasPrev: boolean,
  hasNext: boolean,
): SeamlessResult {
  const next = page + dir;
  if (next >= 0 && next < pageCount) return { kind: "page", page: next };
  if (!seamless) return { kind: "none" };
  if (dir === 1 && hasNext) return { kind: "file", dir: 1 };
  if (dir === -1 && hasPrev) return { kind: "file", dir: -1 };
  return { kind: "none" };
}
