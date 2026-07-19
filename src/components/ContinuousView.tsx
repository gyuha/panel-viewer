import { useEffect, useRef } from "react";
import { pageUrl, type ContinuousFit } from "../lib/api";

interface ContinuousViewProps {
  pageCount: number;
  page: number;
  token: string;
  fit: ContinuousFit;
  seamless: boolean;
  hasPrevFile: boolean;
  hasNextFile: boolean;
  onOpenAdjacent: (dir: -1 | 1) => void;
  onPageChange: (page: number) => void;
}

/** 파일 이어보기 쿨다운(ms): 관성 스크롤이 연속 발동하지 않게. */
const SEAMLESS_COOLDOWN_MS = 500;

/**
 * 연속 스크롤 모드. 세로로 페이지를 쌓아 폭 맞춤으로 보여준다.
 * 오프스크린 이미지는 네이티브 lazy 로딩으로 지연 로드해 대용량에서도 메모리 폭증을 막는다.
 */
export function ContinuousView({
  pageCount,
  page,
  token,
  fit,
  seamless,
  hasPrevFile,
  hasNextFile,
  onOpenAdjacent,
  onPageChange,
}: ContinuousViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const initialPage = useRef(page); // 마운트 시점의 페이지로만 스크롤(이후 스크롤은 자유)
  const suppress = useRef(true); // 초기 프로그램 스크롤 중엔 관찰 무시
  const lastFileTurnAt = useRef(0); // 이어보기 파일 전환 쿨다운

  // 파일 이어보기: 맨 아래에서 휠 다운 → 다음 파일, 맨 위에서 휠 업 → 이전 파일(쿨다운).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !seamless) return;
    const onWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastFileTurnAt.current < SEAMLESS_COOLDOWN_MS) return;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
      const atTop = el.scrollTop <= 4;
      if (e.deltaY > 0 && atBottom && hasNextFile) {
        lastFileTurnAt.current = now;
        onOpenAdjacent(1);
      } else if (e.deltaY < 0 && atTop && hasPrevFile) {
        lastFileTurnAt.current = now;
        onOpenAdjacent(-1);
      }
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => el.removeEventListener("wheel", onWheel);
  }, [seamless, hasPrevFile, hasNextFile, onOpenAdjacent]);

  // 마운트 시 현재 페이지로 스크롤 + 컨테이너에 포커스(클릭 없이도 키보드 스크롤이 바로 되도록)
  useEffect(() => {
    const el = pageRefs.current[initialPage.current];
    if (el) el.scrollIntoView({ block: "start" });
    containerRef.current?.focus({ preventScroll: true });
    const t = setTimeout(() => {
      suppress.current = false;
    }, 150);
    return () => clearTimeout(t);
  }, []);

  // 맨 아래에서 다음-키(Space/PageDown/↓) → 다음 파일, 맨 위에서 이전-키(PageUp/↑) → 이전 파일(이어보기).
  // 경계가 아니거나 이어보기 꺼짐이면 preventDefault 없이 네이티브 스크롤에 맡긴다.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!seamless) return;
    const el = containerRef.current;
    if (!el) return;
    const now = Date.now();
    if (now - lastFileTurnAt.current < SEAMLESS_COOLDOWN_MS) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
    const atTop = el.scrollTop <= 4;
    const isNext = e.key === " " || e.key === "PageDown" || e.key === "ArrowDown";
    const isPrev = e.key === "PageUp" || e.key === "ArrowUp";
    if (isNext && atBottom && hasNextFile) {
      e.preventDefault();
      lastFileTurnAt.current = now;
      onOpenAdjacent(1);
    } else if (isPrev && atTop && hasPrevFile) {
      e.preventDefault();
      lastFileTurnAt.current = now;
      onOpenAdjacent(-1);
    }
  };

  // 스크롤에 따라 현재 페이지(가장 위에 보이는 페이지) 갱신
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (suppress.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => Number((e.target as HTMLElement).dataset.index))
          .sort((a, b) => a - b);
        if (visible.length) onPageChange(visible[0]);
      },
      { root, threshold: 0.2 },
    );
    pageRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [pageCount, onPageChange]);

  return (
    <div className={`continuous fit-${fit}`} ref={containerRef} tabIndex={-1} onKeyDown={onKeyDown}>
      {Array.from({ length: pageCount }, (_, i) => (
        <div
          className="cont-page"
          key={i}
          data-index={i}
          ref={(el) => {
            pageRefs.current[i] = el;
          }}
        >
          <img
            className="cont-img"
            src={pageUrl(i, token)}
            loading="lazy"
            decoding="async"
            alt={`${i + 1}`}
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}
