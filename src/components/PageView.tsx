import { useCallback, useEffect, useRef } from "react";
import { pageUrl } from "../lib/api";
import { nextPage, prevPage, wheelTurn } from "../lib/nav";
import { resolve, type CustomKeys } from "../lib/keymap";

/** 휠 페이지 전환 쿨다운(ms): 한 노치/제스처가 한 페이지가 되도록 억제. */
const WHEEL_COOLDOWN_MS = 200;

interface PageViewProps {
  pageCount: number;
  page: number;
  token: string;
  customKeys: CustomKeys;
  shortcutsEnabled: boolean;
  onPageChange: (page: number) => void;
}

/** 한 장 모드: 화면 맞춤으로 한 페이지씩. 표준 키(→/Space/←/Home/End)+커스텀 키, 좌우 클릭. */
export function PageView({
  pageCount,
  page,
  token,
  customKeys,
  shortcutsEnabled,
  onPageChange,
}: PageViewProps) {
  const goNext = useCallback(
    () => onPageChange(nextPage(page, pageCount)),
    [page, pageCount, onPageChange],
  );
  const goPrev = useCallback(
    () => onPageChange(prevPage(page, pageCount)),
    [page, pageCount, onPageChange],
  );

  const stageRef = useRef<HTMLDivElement>(null);
  const lastWheelAt = useRef(0);

  // 마우스 휠로 페이지 넘김(아래=다음, 위=이전). 쿨다운으로 한 제스처에 과하게 안 넘어감.
  // 스테이지에 직접 붙여(passive:false) preventDefault가 먹도록 한다. 설정 모달 열림 중엔 미발동.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!shortcutsEnabled) return;
      const { turn, dir } = wheelTurn(e.deltaY, Date.now(), lastWheelAt.current, WHEEL_COOLDOWN_MS);
      if (!turn) return;
      e.preventDefault();
      lastWheelAt.current = Date.now();
      if (dir === 1) goNext();
      else goPrev();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [shortcutsEnabled, goNext, goPrev]);

  // 페이지 동작만 처리(파일 이동은 Viewer가 담당). 설정 모달 열림 중엔 미발동.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!shortcutsEnabled) return;
      const action = resolve(e.key, customKeys, "page");
      if (action === "nextPage") {
        e.preventDefault();
        goNext();
      } else if (action === "prevPage") {
        e.preventDefault();
        goPrev();
      } else if (action === "firstPage") {
        e.preventDefault();
        onPageChange(0);
      } else if (action === "lastPage") {
        e.preventDefault();
        onPageChange(pageCount - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcutsEnabled, customKeys, pageCount, onPageChange, goNext, goPrev]);

  // 인접 페이지 프리페치
  useEffect(() => {
    [page + 1, page - 1].forEach((i) => {
      if (i >= 0 && i < pageCount) {
        const img = new Image();
        img.src = pageUrl(i, token);
      }
    });
  }, [page, pageCount, token]);

  return (
    <div className="viewer-stage" ref={stageRef}>
      <img
        className="viewer-page"
        src={pageUrl(page, token)}
        alt={`${page + 1} / ${pageCount}`}
        draggable={false}
      />
      <button className="click-zone left" onClick={goPrev} aria-label="이전 페이지" />
      <button className="click-zone right" onClick={goNext} aria-label="다음 페이지" />
    </div>
  );
}
