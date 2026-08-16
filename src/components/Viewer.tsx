import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewMode } from "../lib/nav";
import type { PageFit, ContinuousFit } from "../lib/api";
import {
  resolve,
  eventKey,
  withKey,
  mouseAction,
  type Action,
  type CustomKeys,
} from "../lib/keymap";
import { PageView } from "./PageView";
import { ContinuousView, type ContinuousHandle } from "./ContinuousView";
import { PageSeekBar } from "./PageSeekBar";
import { AlwaysOnTopIcon } from "./AlwaysOnTopIcon";

interface ViewerProps {
  name: string;
  pageCount: number;
  page: number;
  mode: ViewMode;
  token: string;
  pageFit: PageFit;
  continuousFit: ContinuousFit;
  seamless: boolean;
  cursorAutoHide: boolean;
  cursorHideDelay: number;
  customKeys: CustomKeys;
  shortcutsEnabled: boolean;
  seekOpen: boolean;
  onSeekOpenChange: (open: boolean) => void;
  panelHidden: boolean;
  onTogglePanel: () => void;
  alwaysOnTop: boolean;
  onToggleAlwaysOnTop: () => void;
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

/**
 * 마우스가 delaySec초 동안 "실제로" 움직이지 않으면 true(=커서 숨김)를 돌려준다.
 *
 * mousemove만 듣는다 — 클릭·휠은 커서를 되살리지도, 타이머를 리셋하지도 않는다(요구사항).
 * 좌표 비교 가드가 핵심이다: 웹뷰는 콘텐츠 스크롤이나 이미지 교체 때 마우스가 물리적으로
 * 움직이지 않았는데도 mousemove를 합성해 쏠 수 있고, 그러면 연속 모드에서 휠을 굴릴 때마다
 * 커서가 되살아나 "휠을 해도 보이지 않게"가 깨진다. clientX/Y는 뷰포트 기준이라 커서가
 * 그대로면 콘텐츠가 아무리 스크롤돼도 값이 변하지 않으므로, 같은 좌표는 이동이 아니다.
 */
function useIdleCursor(enabled: boolean, delaySec: number): boolean {
  const [hidden, setHidden] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setHidden(true), delaySec * 1000);
    };
    const onMove = (e: MouseEvent) => {
      const prev = lastPos.current;
      if (prev && prev.x === e.clientX && prev.y === e.clientY) return; // 합성 이벤트 — 이동 아님
      lastPos.current = { x: e.clientX, y: e.clientY };
      setHidden(false);
      arm();
    };
    window.addEventListener("mousemove", onMove);
    arm(); // 파일을 연 뒤 마우스를 한 번도 안 움직여도 숨는다
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (timer) clearTimeout(timer);
    };
  }, [enabled, delaySec]);

  return hidden;
}

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
  cursorAutoHide,
  cursorHideDelay,
  customKeys,
  shortcutsEnabled,
  seekOpen,
  onSeekOpenChange,
  panelHidden,
  onTogglePanel,
  alwaysOnTop,
  onToggleAlwaysOnTop,
  hasPrevFile,
  hasNextFile,
  onPrevFile,
  onNextFile,
  onOpenAdjacent,
  onPageChange,
  onModeChange,
  onClose,
}: ViewerProps) {
  const continuousRef = useRef<ContinuousHandle>(null);
  const cursorHidden = useIdleCursor(cursorAutoHide, cursorHideDelay);

  // 탐색 바가 열려 있으면 기존 읽기 단축키를 죽인다. window 리스너들은 포커스를 보지 않으므로,
  // 이게 없으면 → 한 번에 슬라이더 1칸과 nextPage()가 함께 발동해 두 장이 넘어간다.
  // (설정 모달 쪽 차단은 App이 shortcutsEnabled로 내려보낸다 — 게이트마다 소유자가 하나씩.)
  const keysLive = shortcutsEnabled && !seekOpen;

  // 페이지 탐색: 페이지 상태를 옮기고, 연속 모드에서는 컨테이너도 그 페이지로 스크롤한다
  // (연속 뷰는 page prop 변경만으로는 움직이지 않는다).
  const handleSeek = useCallback(
    (next: number) => {
      onPageChange(next);
      if (mode === "continuous") continuousRef.current?.scrollToPage(next);
    },
    [mode, onPageChange],
  );

  // 모드 무관 단축키: 닫기(Esc) + 파일 이동 + 보기 모드 전환(한장·연속 두 모드). 설정 모달 열림 중엔 미발동.
  // (앱 종료 x는 App의 전역 핸들러가 담당)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!keysLive) return;
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
  }, [keysLive, customKeys, mode, onClose, onNextFile, onPrevFile, onModeChange]);

  // 마우스 뒤로/앞으로 버튼 → 이전/다음 파일(고정 매핑, 재지정 불가). 설정 모달 열림 중엔 미발동.
  // preventDefault는 웹뷰가 스스로 히스토리를 되감는 것에 대한 보험(실측에선 popstate가 없었다).
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (!keysLive) return;
      const action = mouseAction(e.button);
      if (action === "prevFile") {
        e.preventDefault();
        onPrevFile();
      } else if (action === "nextFile") {
        e.preventDefault();
        onNextFile();
      }
    };
    window.addEventListener("mousedown", onMouse);
    return () => window.removeEventListener("mousedown", onMouse);
  }, [keysLive, onPrevFile, onNextFile]);

  return (
    <div className={`viewer no-select ${cursorHidden ? "cursor-hidden" : ""}`}>
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

        <button
          className={`viewer-count ${seekOpen ? "active" : ""}`}
          onClick={() => onSeekOpenChange(!seekOpen)}
          title="페이지 탐색"
        >
          {page + 1} / {pageCount}
        </button>

        <button
          className={`always-on-top-btn ${alwaysOnTop ? "active" : ""}`}
          onClick={onToggleAlwaysOnTop}
          title={withKey("항상 위", customKeys.toggleAlwaysOnTop)}
          aria-label="항상 위"
        >
          <AlwaysOnTopIcon />
        </button>
      </header>

      {mode === "continuous" ? (
        // key에 token 포함 → 파일 전환 시 재마운트되어 새 파일의 현재 페이지로 스크롤
        <ContinuousView
          key={`continuous-${token}`}
          ref={continuousRef}
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
          shortcutsEnabled={keysLive}
          onPageChange={onPageChange}
        />
      )}

      {seekOpen && (
        <PageSeekBar
          page={page}
          pageCount={pageCount}
          onSeek={handleSeek}
          onClose={() => onSeekOpenChange(false)}
        />
      )}
    </div>
  );
}
