import { forwardRef, useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { pageUrl, type ContinuousFit } from "../lib/api";
import { scrollTopForPage } from "../lib/nav";

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

/** 밖에서 특정 페이지로 스크롤시키기 위한 명령 통로(페이지 탐색 슬라이더가 쓴다). */
export interface ContinuousHandle {
  scrollToPage: (index: number) => void;
}

/** 파일 이어보기 쿨다운(ms): 관성 스크롤이 연속 발동하지 않게. */
const SEAMLESS_COOLDOWN_MS = 500;

/**
 * 연속 스크롤 모드. 세로로 페이지를 쌓아 폭 맞춤으로 보여준다.
 * 오프스크린 이미지는 네이티브 lazy 로딩으로 지연 로드해 대용량에서도 메모리 폭증을 막는다.
 */
function ContinuousViewImpl(
  {
    pageCount,
    page,
    token,
    fit,
    seamless,
    hasPrevFile,
    hasNextFile,
    onOpenAdjacent,
    onPageChange,
  }: ContinuousViewProps,
  ref: Ref<ContinuousHandle>,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const initialPage = useRef(page); // 마운트 시점의 페이지로만 스크롤(이후 스크롤은 자유)
  const suppress = useRef(true); // 초기 프로그램 스크롤 중엔 관찰 무시
  const lastFileTurnAt = useRef(0); // 이어보기 파일 전환 쿨다운
  // 휠 핸들러가 스크롤 중 재구독되지 않도록 최신 props를 ref로 읽는다.
  const cb = useRef({ seamless, hasPrevFile, hasNextFile, onOpenAdjacent });
  cb.current = { seamless, hasPrevFile, hasNextFile, onOpenAdjacent };

  // 마우스 휠을 가로채 부드럽게(이징) 스크롤 + 경계에서 파일 이어보기. (마운트 시 1회 구독)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let target = el.scrollTop; // 목표 스크롤 위치
    let animating = false;
    let raf = 0;

    const tick = () => {
      // 지연 로딩으로 콘텐츠 높이(scrollHeight)가 바뀌어도 target을 현재 max로 재클램프한다.
      // 이게 없으면 도달 불가한 target에 갇혀 animating이 영구히 true가 되고, 루프가 매 프레임
      // scrollTop을 덮어써 키 스크롤이 계속 죽는다.
      target = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, target));
      const cur = el.scrollTop;
      const d = target - cur;
      if (Math.abs(d) < 0.5) {
        el.scrollTop = target;
        animating = false;
        return;
      }
      el.scrollTop = cur + d * 0.2; // 남은 거리의 20%씩 접근 → 부드러운 감속
      raf = requestAnimationFrame(tick);
    };

    const onWheel = (e: WheelEvent) => {
      el.focus({ preventScroll: true }); // 휠 조작 중 포커스를 컨테이너에 유지 → 이후 키 스크롤이 계속 먹힘
      const { seamless: sl, hasPrevFile: hp, hasNextFile: hn, onOpenAdjacent: open } = cb.current;
      // 경계 + 이어보기: 다음/이전 파일로 전환(쿨다운)
      if (sl) {
        const now = Date.now();
        if (now - lastFileTurnAt.current >= SEAMLESS_COOLDOWN_MS) {
          const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
          const atTop = el.scrollTop <= 4;
          if (e.deltaY > 0 && atBottom && hn) {
            e.preventDefault();
            lastFileTurnAt.current = now;
            open(1);
            return;
          }
          if (e.deltaY < 0 && atTop && hp) {
            e.preventDefault();
            lastFileTurnAt.current = now;
            open(-1);
            return;
          }
        }
      }
      // 부드러운 스크롤
      e.preventDefault();
      const px =
        e.deltaMode === 1
          ? e.deltaY * 16 // 줄 단위 → px
          : e.deltaMode === 2
            ? e.deltaY * el.clientHeight // 페이지 단위 → px
            : e.deltaY;
      const max = el.scrollHeight - el.clientHeight;
      if (!animating) target = el.scrollTop; // 스크롤바/키 이동과 동기화
      target = Math.max(0, Math.min(max, target + px));
      if (!animating) {
        animating = true;
        raf = requestAnimationFrame(tick);
      }
    };

    // 키 입력이 들어오면 진행 중인 휠 관성 애니메이션을 즉시 중단 → rAF 루프가 scrollTop을
    // 계속 덮어써 네이티브 키 스크롤(스페이스/화살표/PageUp·Down)을 무력화하는 것을 막는다.
    const stopAnim = () => {
      if (animating) {
        cancelAnimationFrame(raf);
        animating = false;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", stopAnim);
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", stopAnim);
      cancelAnimationFrame(raf);
    };
  }, []);

  // 밖(페이지 탐색 슬라이더)에서 임의 페이지로 스크롤시키는 통로.
  // initialPage는 마운트 시점 값에 고정이라 page prop 변경만으로는 스크롤되지 않는다.
  // offsetTop을 쓰지 않는 이유는 scrollTopForPage의 주석 참고.
  useImperativeHandle(ref, () => ({
    scrollToPage: (index: number) => {
      const root = containerRef.current;
      const el = pageRefs.current[index];
      if (!root || !el) return;
      root.scrollTop = scrollTopForPage(
        root.scrollTop,
        root.getBoundingClientRect().top,
        el.getBoundingClientRect().top,
      );
    },
  }), []);

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
    <div
      className={`continuous fit-${fit}`}
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onMouseDown={() => containerRef.current?.focus({ preventScroll: true })}
    >
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

export const ContinuousView = forwardRef(ContinuousViewImpl);
