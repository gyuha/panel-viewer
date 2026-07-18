import { useCallback, useEffect } from "react";
import { pageUrl } from "../lib/api";
import { arrowAdvance, nextPage, prevPage } from "../lib/nav";

interface PageViewProps {
  pageCount: number;
  page: number;
  mode: "ltr" | "rtl";
  onPageChange: (page: number) => void;
}

/** 페이지 모드(한 장씩, 화면 맞춤). 좌→우/우→좌 방향에 따라 키·클릭 매핑이 바뀐다. */
export function PageView({ pageCount, page, mode, onPageChange }: PageViewProps) {
  const goNext = useCallback(
    () => onPageChange(nextPage(page, pageCount)),
    [page, pageCount, onPageChange],
  );
  const goPrev = useCallback(
    () => onPageChange(prevPage(page, pageCount)),
    [page, pageCount, onPageChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          onPageChange(arrowAdvance("left", page, pageCount, mode));
          break;
        case "ArrowRight":
          e.preventDefault();
          onPageChange(arrowAdvance("right", page, pageCount, mode));
          break;
        case " ":
        case "PageDown":
          e.preventDefault();
          goNext();
          break;
        case "PageUp":
          e.preventDefault();
          goPrev();
          break;
        case "Home":
          e.preventDefault();
          onPageChange(0);
          break;
        case "End":
          e.preventDefault();
          onPageChange(pageCount - 1);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, pageCount, mode, onPageChange, goNext, goPrev]);

  // 인접 페이지 프리페치
  useEffect(() => {
    [page + 1, page - 1].forEach((i) => {
      if (i >= 0 && i < pageCount) {
        const img = new Image();
        img.src = pageUrl(i);
      }
    });
  }, [page, pageCount]);

  // 클릭 영역: 좌→우는 왼쪽=이전/오른쪽=다음, 우→좌는 반대
  const onLeftClick = mode === "rtl" ? goNext : goPrev;
  const onRightClick = mode === "rtl" ? goPrev : goNext;

  return (
    <div className="viewer-stage">
      <img
        className="viewer-page"
        src={pageUrl(page)}
        alt={`${page + 1} / ${pageCount}`}
        draggable={false}
      />
      <button className="click-zone left" onClick={onLeftClick} aria-label="왼쪽" />
      <button className="click-zone right" onClick={onRightClick} aria-label="오른쪽" />
    </div>
  );
}
