import { useEffect } from "react";
import type { ViewMode } from "../lib/nav";
import { PageView } from "./PageView";
import { ContinuousView } from "./ContinuousView";

interface ViewerProps {
  name: string;
  pageCount: number;
  page: number;
  mode: ViewMode;
  token: string;
  onPageChange: (page: number) => void;
  onModeChange: (mode: ViewMode) => void;
  onClose: () => void;
}

const MODES: { key: ViewMode; label: string; title: string }[] = [
  { key: "ltr", label: "좌→우", title: "좌→우 페이지 모드" },
  { key: "rtl", label: "우→좌", title: "우→좌 페이지 모드" },
  { key: "continuous", label: "연속", title: "연속 스크롤 모드" },
];

/** 보기 모드에 따라 페이지/연속 뷰를 전환하는 컨테이너. 현재 페이지는 전환 시 유지된다. */
export function Viewer({
  name,
  pageCount,
  page,
  mode,
  token,
  onPageChange,
  onModeChange,
  onClose,
}: ViewerProps) {
  // 모드 무관 단축키(닫기)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="viewer no-select">
      <header className="viewer-bar">
        <button className="btn-ghost" onClick={onClose} title="닫기 (Esc)">
          ‹ 닫기
        </button>
        <span className="viewer-title">{name}</span>

        <div className="mode-toggle" role="group" aria-label="보기 모드">
          {MODES.map((m) => (
            <button
              key={m.key}
              className={`mode-btn ${mode === m.key ? "active" : ""}`}
              onClick={() => onModeChange(m.key)}
              title={m.title}
            >
              {m.label}
            </button>
          ))}
        </div>

        <span className="viewer-count">
          {page + 1} / {pageCount}
        </span>
      </header>

      {mode === "continuous" ? (
        // key에 token 포함 → 파일 전환 시 재마운트되어 새 파일의 현재 페이지로 스크롤
        <ContinuousView
          key={`continuous-${token}`}
          pageCount={pageCount}
          page={page}
          token={token}
          onPageChange={onPageChange}
        />
      ) : (
        <PageView
          pageCount={pageCount}
          page={page}
          mode={mode}
          token={token}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
