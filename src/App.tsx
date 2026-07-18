import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  openArchive,
  loadState,
  saveReadingPosition,
  saveViewMode,
  saveLastFolder,
  takePendingFile,
  type ArchiveInfo,
} from "./lib/api";
import type { ViewMode } from "./lib/nav";
import { Viewer } from "./components/Viewer";
import { FilePanel } from "./components/FilePanel";
import "./App.css";

const ARCHIVE_EXTS = ["cbz", "cbr", "zip"];

function hasArchiveExt(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase();
  return !!ext && ARCHIVE_EXTS.includes(ext);
}

function App() {
  const [ready, setReady] = useState(false);
  const [initialFolder, setInitialFolder] = useState<string | null>(null);
  const [info, setInfo] = useState<ArchiveInfo | null>(null);
  const [openedPath, setOpenedPath] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<ViewMode>("ltr");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [fileToken, setFileToken] = useState("");
  const readingPositions = useRef<Record<string, number>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openSeq = useRef(0);

  const openPath = useCallback(async (path: string) => {
    try {
      const i = await openArchive(path);
      openSeq.current += 1;
      setFileToken(String(openSeq.current));
      setOpenedPath(path);
      setInfo(i);
      const saved = readingPositions.current[path] ?? 0;
      setPage(saved < i.pageCount ? saved : 0);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  // 시작 시 영속 상태 복원(보기 모드 · 읽던 위치 맵 · 마지막 폴더)
  useEffect(() => {
    void loadState().then((s) => {
      setMode(s.viewMode);
      readingPositions.current = s.readingPositions ?? {};
      setInitialFolder(s.lastFolder);
      setReady(true);
    });
  }, []);

  // 파일 연결로 넘어온 파일 처리(시작 시 대기 파일 + 실행 중 open-archive 이벤트)
  useEffect(() => {
    void takePendingFile().then((p) => {
      if (p) void openPath(p);
    });
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

  const handleFolderChange = useCallback((folder: string) => {
    void saveLastFolder(folder);
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

  if (!ready) {
    return <div className="boot" />;
  }

  return (
    <div className={`app-shell ${dragOver ? "drag" : ""}`}>
      <FilePanel
        openedPath={openedPath}
        onOpenFile={openPath}
        initialFolder={initialFolder}
        onFolderChange={handleFolderChange}
      />
      <div className="app-main">
        {info ? (
          <Viewer
            name={info.name}
            pageCount={info.pageCount}
            page={page}
            mode={mode}
            token={fileToken}
            onPageChange={handlePageChange}
            onModeChange={handleModeChange}
            onClose={() => {
              setInfo(null);
              setOpenedPath(null);
            }}
          />
        ) : (
          <div className="empty">
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
    </div>
  );
}

export default App;
