// 페이지 내비게이션 순수 로직. 보기 모드와 무관한 "읽기 순서상" 다음/이전을 계산하고,
// 방향키→페이지 매핑만 보기 모드(좌→우/우→좌)를 고려한다.

export type ViewMode = "ltr" | "rtl" | "continuous";

/** page를 [0, count-1]로 클램프한다. count가 0이면 0. */
export function clampPage(page: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(page, count - 1));
}

/** 읽기 순서상 다음 페이지(마지막에서 멈춤). */
export function nextPage(page: number, count: number): number {
  return clampPage(page + 1, count);
}

/** 읽기 순서상 이전 페이지(처음에서 멈춤). */
export function prevPage(page: number, count: number): number {
  return clampPage(page - 1, count);
}

/**
 * 좌/우 방향키 입력을 보기 모드에 맞춰 새 페이지로 변환한다.
 * 좌→우 모드: 오른쪽 = 다음, 왼쪽 = 이전.
 * 우→좌 모드: 왼쪽 = 다음, 오른쪽 = 이전.
 */
export function arrowAdvance(
  key: "left" | "right",
  page: number,
  count: number,
  mode: "ltr" | "rtl",
): number {
  const forward =
    (mode === "ltr" && key === "right") || (mode === "rtl" && key === "left");
  return forward ? nextPage(page, count) : prevPage(page, count);
}
