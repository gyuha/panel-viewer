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

  // 마운트 시 현재 페이지 위치로 스크롤(페이지 모드 → 연속 모드 전환 시 위치 유지)
  useEffect(() => {
    const el = pageRefs.current[initialPage.current];
    if (el) el.scrollIntoView({ block: "start" });
    const t = setTimeout(() => {
      suppress.current = false;
    }, 150);
    return () => clearTimeout(t);
  }, []);

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
    <div className={`continuous fit-${fit}`} ref={containerRef}>
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
