import { useEffect } from "react";
import type { ViewMode } from "../lib/nav";
import type { PageFit, ContinuousFit } from "../lib/api";
import { resolve, eventKey, withKey, type Action, type CustomKeys } from "../lib/keymap";
import { PageView } from "./PageView";
import { ContinuousView } from "./ContinuousView";

interface ViewerProps {
  name: string;
  pageCount: number;
  page: number;
  mode: ViewMode;
  token: string;
  pageFit: PageFit;
  continuousFit: ContinuousFit;
  seamless: boolean;
  customKeys: CustomKeys;
  shortcutsEnabled: boolean;
  panelHidden: boolean;
  onTogglePanel: () => void;
  hasPrevFile: boolean;
  hasNextFile: boolean;
  onPrevFile: () => void;
  onNextFile: () => void;
  onOpenAdjacent: (dir: -1 | 1) => void;
  onPageChange: (page: number) => void;
  onModeChange: (mode: ViewMode) => void;
  onClose: () => void;
}

const MODES: { key: ViewMode; label: string; title: string; action: Action }[] = [
  { key: "page", label: "한장", title: "한 장씩 보기", action: "modePage" },
  { key: "continuous", label: "연속", title: "연속 스크롤 보기", action: "modeContinuous" },
];

/** 보기 모드에 따라 페이지/연속 뷰를 전환하는 컨테이너. 현재 페이지는 전환 시 유지된다. */
export function Viewer({
  name,
  pageCount,
  page,
  mode,
  token,
  pageFit,
  continuousFit,
  seamless,
  customKeys,
  shortcutsEnabled,
  panelHidden,
  onTogglePanel,
  hasPrevFile,
  hasNextFile,
  onPrevFile,
  onNextFile,
  onOpenAdjacent,
  onPageChange,
  onModeChange,
  onClose,
}: ViewerProps) {
  // 모드 무관 단축키: 닫기(Esc) + 파일 이동 + 보기 모드 전환(한장·연속 두 모드). 설정 모달 열림 중엔 미발동.
  // (앱 종료 x는 App의 전역 핸들러가 담당)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!shortcutsEnabled) return;
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const action = resolve(eventKey(e), customKeys, mode);
      if (action === "nextFile") {
        e.preventDefault();
        onNextFile();
      } else if (action === "prevFile") {
        e.preventDefault();
        onPrevFile();
      } else if (action === "modePage") {
        e.preventDefault();
        onModeChange("page");
      } else if (action === "modeContinuous") {
        e.preventDefault();
        onModeChange("continuous");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcutsEnabled, customKeys, mode, onClose, onNextFile, onPrevFile, onModeChange]);

  return (
    <div className="viewer no-select">
      <header className="viewer-bar">
        {panelHidden && (
          <button
            className="panel-toggle-btn"
            onClick={onTogglePanel}
            title={withKey("파일 목록 보이기", customKeys.togglePanel)}
            aria-label="파일 목록 보이기"
          >
            ☰
          </button>
        )}
        <div className="file-nav" role="group" aria-label="파일 이동">
          <button
            className="file-nav-btn"
            onClick={onPrevFile}
            disabled={!hasPrevFile}
            title="이전 파일"
          >
            &lt;
          </button>
          <button
            className="file-nav-btn"
            onClick={onNextFile}
            disabled={!hasNextFile}
            title="다음 파일"
          >
            &gt;
          </button>
        </div>

        <span className="viewer-title">{name}</span>

        <div className="mode-toggle" role="group" aria-label="보기 모드">
          {MODES.map((m) => (
            <button
              key={m.key}
              className={`mode-btn ${mode === m.key ? "active" : ""}`}
              onClick={() => onModeChange(m.key)}
              title={withKey(m.title, customKeys[m.action])}
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
          fit={continuousFit}
          seamless={seamless}
          hasPrevFile={hasPrevFile}
          hasNextFile={hasNextFile}
          onOpenAdjacent={onOpenAdjacent}
          onPageChange={onPageChange}
        />
      ) : (
        <PageView
          pageCount={pageCount}
          page={page}
          token={token}
          fit={pageFit}
          seamless={seamless}
          hasPrevFile={hasPrevFile}
          hasNextFile={hasNextFile}
          onOpenAdjacent={onOpenAdjacent}
          customKeys={customKeys}
          shortcutsEnabled={shortcutsEnabled}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
