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
