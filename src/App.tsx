import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  openArchive,
  loadState,
  saveReadingPosition,
  saveViewMode,
  saveLastFolder,
  takePendingFile,
  readDir,
  saveKeybindings,
  savePanelHidden,
  saveWindowSize,
  savePageFit,
  saveContinuousFit,
  saveLastFile,
  saveOpenLastFile,
  saveSeamless,
  recordHistory,
  deleteHistory,
  resetHistory,
  quitApp,
  type ArchiveInfo,
  type DirListing,
  type PageFit,
  type ContinuousFit,
  type HistoryEntry,
} from "./lib/api";
import type { ViewMode } from "./lib/nav";
import { DEFAULT_CUSTOM, eventKey, withKey, type Action, type CustomKeys } from "./lib/keymap";
import { basename, indexInFolder } from "./lib/folder";
import { Viewer } from "./components/Viewer";
import { FilePanel } from "./components/FilePanel";
import { SettingsModal } from "./components/SettingsModal";
import "./App.css";

const ARCHIVE_EXTS = ["cbz", "cbr", "zip"];

function hasArchiveExt(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase();
  return !!ext && ARCHIVE_EXTS.includes(ext);
}

/** 경로의 상위 폴더. 구분자는 / 와 \ 모두 처리. */
function dirname(p: string): string {
  const i = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return i > 0 ? p.slice(0, i) : p;
}

function App() {
  const [ready, setReady] = useState(false);
  const [info, setInfo] = useState<ArchiveInfo | null>(null);
  const [openedPath, setOpenedPath] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<ViewMode>("page");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [customKeys, setCustomKeys] = useState<CustomKeys>(DEFAULT_CUSTOM);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [seekOpen, setSeekOpen] = useState(false);
  const [panelHidden, setPanelHidden] = useState(false);
  const [pageFit, setPageFit] = useState<PageFit>("screen");
  const [continuousFit, setContinuousFit] = useState<ContinuousFit>("width");
  const [openLastFile, setOpenLastFile] = useState(true);
  const [seamless, setSeamless] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [fileToken, setFileToken] = useState("");
  // 현재 폴더 단일 소스: 패널 목록이자 이전/다음 파일 이동의 범위
  const [listing, setListing] = useState<DirListing | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const readingPositions = useRef<Record<string, number>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openSeq = useRef(0);
  const opening = useRef(false); // 재진입 가드: 여는 중엔 겹친 열기 요청 무시

  // 현재 폴더 이동(패널 폴더 클릭 등). 목록을 읽어 현재 폴더로 설정하고 마지막 폴더로 저장.
  const navigate = useCallback(async (path: string | null) => {
    try {
      const l = await readDir(path);
      setListing(l);
      setFolderError(null);
      void saveLastFolder(l.current);
    } catch (e) {
      setFolderError(String(e));
    }
  }, []);

  const openPath = useCallback(
    async (path: string, opts?: { atLastPage?: boolean; silent?: boolean }) => {
      if (opening.current) return;
      opening.current = true;
      try {
        const i = await openArchive(path);
        // 현재 폴더를 열린 파일의 폴더로 동기화하고, 파일명(NFC) 매칭으로 정규 경로를 얻는다.
        let canonical = path;
        try {
          const l = await readDir(dirname(path));
          setListing(l);
          setFolderError(null);
          void saveLastFolder(l.current);
          const archives = l.files.filter((f) => f.kind === "archive").map((f) => f.path);
          const idx = indexInFolder(archives, path);
          if (idx >= 0) canonical = archives[idx];
        } catch {
          /* 폴더를 못 읽어도 파일 자체는 연다 */
        }
        openSeq.current += 1;
        setFileToken(String(openSeq.current));
        setOpenedPath(canonical);
        setInfo(i);
        if (opts?.atLastPage) {
          setPage(i.pageCount - 1); // 이어보기로 이전 파일을 열 땐 마지막 페이지부터
        } else {
          const saved = readingPositions.current[canonical] ?? 0;
          setPage(saved < i.pageCount ? saved : 0);
        }
        setError(null);
        void saveLastFile(canonical); // 마지막으로 연 파일 기억
        // 히스토리 기록(백엔드 영속 + 즉시 반영용 로컬 미러: 중복 제거→맨 위→상한 500)
        void recordHistory(canonical);
        setHistory((prev) => {
          const filtered = prev.filter((e) => e.path !== canonical);
          return [
            { path: canonical, name: basename(canonical), openedAt: Date.now() },
            ...filtered,
          ].slice(0, 500);
        });
      } catch (e) {
        if (!opts?.silent) setError(String(e)); // 마지막 파일 자동 열기 실패는 조용히 스킵
      } finally {
        opening.current = false;
      }
    },
    [],
  );

  // 시작 시 영속 상태 복원(보기 모드 · 읽던 위치 맵 · 마지막 폴더 · 옵션) + 초기 파일 열기
  useEffect(() => {
    void loadState().then(async (s) => {
      setMode(s.viewMode);
      readingPositions.current = s.readingPositions ?? {};
      // 저장된 커스텀 키를 기본값과 병합(없는 동작은 기본값 유지)
      setCustomKeys({ ...DEFAULT_CUSTOM, ...(s.keybindings ?? {}) });
      setPanelHidden(s.panelHidden ?? false);
      setPageFit(s.pageFit ?? "screen");
      setContinuousFit(s.continuousFit ?? "width");
      setOpenLastFile(s.openLastFile ?? true);
      setSeamless(s.seamless ?? false);
      setHistory(s.history ?? []);
      setReady(true);
      void navigate(s.lastFolder); // 현재 폴더를 마지막 폴더(없으면 홈)로
      // 초기 열기: 파일 연결/CLI 대기 파일 우선, 없으면 옵션 켜져 있을 때 마지막 파일(조용히)
      const pending = await takePendingFile();
      if (pending) void openPath(pending);
      else if (s.openLastFile && s.lastFile) void openPath(s.lastFile, { silent: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setBinding = useCallback((action: Action, key: string) => {
    setCustomKeys((prev) => {
      const next = { ...prev, [action]: key };
      void saveKeybindings(next);
      return next;
    });
  }, []);

  const resetBindings = useCallback(() => {
    setCustomKeys(DEFAULT_CUSTOM);
    void saveKeybindings(DEFAULT_CUSTOM);
  }, []);

  const togglePanel = useCallback(() => {
    const next = !panelHidden;
    setPanelHidden(next);
    void savePanelHidden(next);
  }, [panelHidden]);

  // 전역 단축키: Cmd+,(메뉴 열기=설정, 고정) · 앱 종료 · 패널 토글(둘 다 재지정 가능).
  // 파일 안 열려 있어도 동작. 설정 모달·페이지 탐색 바 열림 중엔 미발동
  // (탐색 바에서 슬라이더를 조작하는 중에 x가 앱을 종료시키면 안 된다).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (settingsOpen || seekOpen) return;
      // 메뉴 열기: macOS 표준 Cmd+, (고정, 재지정 불가)
      if (e.metaKey && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }
      // 단일 키 커스텀 동작은 수식 키 없이만(Cmd+x 등으로 오발동 방지)
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = eventKey(e);
      if (customKeys.quitApp !== "" && k === customKeys.quitApp) {
        e.preventDefault();
        void quitApp();
        return;
      }
      if (customKeys.togglePanel !== "" && k === customKeys.togglePanel) {
        e.preventDefault();
        togglePanel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen, seekOpen, customKeys, togglePanel]);

  // 파일 연결로 실행 중 넘어오는 open-archive 이벤트 처리(시작 시 대기 파일은 위 복원 효과에서 소비)
  useEffect(() => {
    const un = listen<string>("open-archive", (e) => {
      if (e.payload) void openPath(e.payload);
    });
    return () => {
      void un.then((f) => f());
    };
  }, [openPath]);

  const pickFile = useCallback(async () => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: "코믹 아카이브", extensions: ARCHIVE_EXTS }],
    });
    if (typeof selected === "string") await openPath(selected);
  }, [openPath]);

  const handlePageChange = useCallback(
    (next: number) => {
      setPage(next);
      const path = openedPath;
      if (!path) return;
      readingPositions.current[path] = next;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveReadingPosition(path, next);
      }, 400);
    },
    [openedPath],
  );

  const handleModeChange = useCallback((next: ViewMode) => {
    setMode(next);
    void saveViewMode(next);
  }, []);

  const handlePageFit = useCallback((fit: PageFit) => {
    setPageFit(fit);
    void savePageFit(fit);
  }, []);

  const handleContinuousFit = useCallback((fit: ContinuousFit) => {
    setContinuousFit(fit);
    void saveContinuousFit(fit);
  }, []);

  const handleOpenLastFile = useCallback((enabled: boolean) => {
    setOpenLastFile(enabled);
    void saveOpenLastFile(enabled);
  }, []);

  const handleSeamless = useCallback((enabled: boolean) => {
    setSeamless(enabled);
    void saveSeamless(enabled);
  }, []);

  const handleDeleteHistory = useCallback((path: string) => {
    setHistory((prev) => prev.filter((e) => e.path !== path));
    void deleteHistory(path);
  }, []);

  const handleResetHistory = useCallback(() => {
    setHistory([]);
    void resetHistory();
  }, []);

  // 창 전체 드래그 앤 드롭
  useEffect(() => {
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      const p = event.payload;
      if (p.type === "enter" || p.type === "over") {
        setDragOver(true);
      } else if (p.type === "leave") {
        setDragOver(false);
      } else if (p.type === "drop") {
        setDragOver(false);
        const file = p.paths.find(hasArchiveExt);
        if (file) void openPath(file);
        else if (p.paths.length) setError("지원하지 않는 파일입니다. (cbz · cbr · zip)");
      }
    });
    return () => {
      void unlisten.then((f) => f());
    };
  }, [openPath]);

  // 창 크기 변경을 디바운스해 저장(복원은 백엔드 setup()이 담당).
  useEffect(() => {
    const win = getCurrentWindow();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const un = win.onResized(({ payload }) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void win.scaleFactor().then((sf) => {
          void saveWindowSize(payload.width / sf, payload.height / sf);
        });
      }, 400);
    });
    return () => {
      if (timer) clearTimeout(timer);
      void un.then((f) => f());
    };
  }, []);

  if (!ready) {
    return <div className="boot" />;
  }

  // 현재 폴더의 아카이브 목록 기준 이전/다음 파일
  const folderArchives = listing
    ? listing.files.filter((f) => f.kind === "archive").map((f) => f.path)
    : [];
  const currentIndex = openedPath ? indexInFolder(folderArchives, openedPath) : -1;
  const hasPrevFile = currentIndex > 0;
  const hasNextFile = currentIndex >= 0 && currentIndex < folderArchives.length - 1;

  return (
    <div className={`app-shell ${dragOver ? "drag" : ""}`}>
      {!panelHidden && (
        <FilePanel
          listing={listing}
          error={folderError}
          openedPath={openedPath}
          history={history}
          togglePanelKey={customKeys.togglePanel}
          onNavigate={navigate}
          onOpenFile={openPath}
          onDeleteHistory={handleDeleteHistory}
          onResetHistory={handleResetHistory}
          onOpenSettings={() => setSettingsOpen(true)}
          onTogglePanel={togglePanel}
        />
      )}
      <div className="app-main">
        {info ? (
          <Viewer
            name={info.name}
            pageCount={info.pageCount}
            page={page}
            mode={mode}
            token={fileToken}
            pageFit={pageFit}
            continuousFit={continuousFit}
            seamless={seamless}
            customKeys={customKeys}
            shortcutsEnabled={!settingsOpen}
            seekOpen={seekOpen}
            onSeekOpenChange={setSeekOpen}
            panelHidden={panelHidden}
            onTogglePanel={togglePanel}
            hasPrevFile={hasPrevFile}
            hasNextFile={hasNextFile}
            onPrevFile={() => {
              if (hasPrevFile) void openPath(folderArchives[currentIndex - 1]);
            }}
            onNextFile={() => {
              if (hasNextFile) void openPath(folderArchives[currentIndex + 1]);
            }}
            onOpenAdjacent={(dir) => {
              if (dir === 1 && hasNextFile) void openPath(folderArchives[currentIndex + 1]);
              else if (dir === -1 && hasPrevFile)
                void openPath(folderArchives[currentIndex - 1], { atLastPage: true });
            }}
            onPageChange={handlePageChange}
            onModeChange={handleModeChange}
            onClose={() => {
              setInfo(null);
              setOpenedPath(null);
              setSeekOpen(false);
            }}
          />
        ) : (
          <div className="empty">
            {panelHidden && (
              <button
                className="panel-show-btn"
                onClick={togglePanel}
                title={withKey("파일 목록", customKeys.togglePanel)}
                aria-label="파일 목록 보이기"
              >
                ☰
              </button>
            )}
            <div className="empty-card">
              <h1 className="empty-title">Panel Viewer</h1>
              <p className="empty-sub">왼쪽에서 파일을 고르거나 파일을 열어보세요.</p>
              <button className="btn-primary" onClick={pickFile}>
                파일 열기
              </button>
              <p className="empty-hint">cbz · cbr · zip 파일을 창에 끌어다 놓아도 됩니다.</p>
              {error && <p className="empty-error">{error}</p>}
            </div>
          </div>
        )}
      </div>

      {settingsOpen && (
        <SettingsModal
          customKeys={customKeys}
          onSet={setBinding}
          onReset={resetBindings}
          pageFit={pageFit}
          continuousFit={continuousFit}
          onSetPageFit={handlePageFit}
          onSetContinuousFit={handleContinuousFit}
          openLastFile={openLastFile}
          seamless={seamless}
          onSetOpenLastFile={handleOpenLastFile}
          onSetSeamless={handleSeamless}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
