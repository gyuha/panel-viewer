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
