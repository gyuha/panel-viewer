import { useEffect, useRef, useState } from "react";
import {
  imageThumbnailUrl,
  systemIconUrl,
  type DirEntry,
  type DirListing,
  type HistoryEntry,
} from "../lib/api";
import { withKey } from "../lib/keymap";

interface FilePanelProps {
  listing: DirListing | null;
  error: string | null;
  openedPath: string | null;
  history: HistoryEntry[];
  togglePanelKey: string;
  onNavigate: (path: string) => void;
  onOpenFile: (path: string) => void;
  onDeleteHistory: (path: string) => void;
  onResetHistory: () => void;
  onOpenSettings: () => void;
  onTogglePanel: () => void;
}

const HISTORY_PAGE_SIZE = 20;

/** epoch ms → 짧은 날짜/시각. */
function formatTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

/**
 * 왼쪽 파일 패널(제어 컴포넌트). 현재 폴더의 목록은 App이 소유하고 props로 내려주며,
 * 폴더 클릭은 onNavigate로 위임한다.
 */
export function FilePanel({
  listing,
  error,
  openedPath,
  history,
  togglePanelKey,
  onNavigate,
  onOpenFile,
  onDeleteHistory,
  onResetHistory,
  onOpenSettings,
  onTogglePanel,
}: FilePanelProps) {
  const [view, setView] = useState<"folder" | "history">("folder");
  const [hpage, setHpage] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);

  const pageCount = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  const page = Math.min(hpage, pageCount - 1);
  const pageItems = history.slice(
    page * HISTORY_PAGE_SIZE,
    page * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE,
  );

  return (
    <aside className="panel">
      <div className="panel-head">
        <button
          className="panel-toggle-btn"
          onClick={onTogglePanel}
          title={withKey("파일 목록 숨기기", togglePanelKey)}
          aria-label="파일 목록 숨기기"
        >
          ☰
        </button>
        <div className="panel-path" title={listing?.current}>
          {view === "history" ? "히스토리" : listing ? shorten(listing.current) : "…"}
        </div>
      </div>

      <div className="panel-tabs">
        <button
          className={`ptab ${view === "folder" ? "active" : ""}`}
          onClick={() => setView("folder")}
        >
          폴더
        </button>
        <button
          className={`ptab ${view === "history" ? "active" : ""}`}
          onClick={() => {
            setView("history");
            setConfirmReset(false);
          }}
        >
          히스토리
        </button>
      </div>

      {view === "history" ? (
        <div className="panel-list">
          {history.length === 0 ? (
            <p className="panel-empty">히스토리가 없습니다.</p>
          ) : (
            pageItems.map((h) => (
              <div key={h.path} className={`hist-row ${h.path === openedPath ? "active" : ""}`}>
                <button className="hist-open" onClick={() => onOpenFile(h.path)} title={h.path}>
                  <span className="hist-name">{h.name}</span>
                  <span className="hist-time">{formatTime(h.openedAt)}</span>
                </button>
                <button className="hist-del" title="삭제" onClick={() => onDeleteHistory(h.path)}>
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="panel-list">
          {listing?.parent && (
          <button className="dir-row" onClick={() => onNavigate(listing.parent!)}>
            <span className="dir-icon">↩</span>
            <span className="dir-name">상위 폴더</span>
          </button>
        )}
        {listing?.folders.map((f) => (
          <button key={f.path} className="dir-row" onClick={() => onNavigate(f.path)}>
            <span className="dir-icon">📁</span>
            <span className="dir-name">{f.name}</span>
          </button>
        ))}
        {listing?.files.map((f) => (
          <FileRow
            key={f.path}
            entry={f}
            active={f.path === openedPath}
            onOpen={onOpenFile}
          />
        ))}
        {listing && listing.folders.length === 0 && listing.files.length === 0 && (
          <p className="panel-empty">이 폴더에 코믹 파일이 없습니다.</p>
        )}
        {error && <p className="panel-error">{error}</p>}
        </div>
      )}

      <div className="panel-foot">
        {view === "history" && history.length > 0 && (
          <div className="hist-controls">
            <div className="hist-paging">
              <button disabled={page <= 0} onClick={() => setHpage(page - 1)} aria-label="이전 페이지">
                ‹
              </button>
              <span>
                {page + 1} / {pageCount}
              </span>
              <button
                disabled={page >= pageCount - 1}
                onClick={() => setHpage(page + 1)}
                aria-label="다음 페이지"
              >
                ›
              </button>
            </div>
            {confirmReset ? (
              <span className="hist-reset-confirm">
                모두 지울까요?
                <button
                  onClick={() => {
                    onResetHistory();
                    setConfirmReset(false);
                    setHpage(0);
                  }}
                >
                  예
                </button>
                <button onClick={() => setConfirmReset(false)}>아니오</button>
              </span>
            ) : (
              <button className="hist-reset" onClick={() => setConfirmReset(true)}>
                전체 리셋
              </button>
            )}
          </div>
        )}
        <button className="panel-settings-btn" onClick={onOpenSettings} title="설정">
          ⚙︎ 설정
        </button>
      </div>
    </aside>
  );
}

/**
 * 파일 한 줄. 이미지 파일은 화면에 보일 때 지연 썸네일, 그 외(아카이브 등)는
 * 확장자별 캐시된 시스템 파일 아이콘. 클릭으로 여는 것은 아카이브만.
 */
function FileRow({
  entry,
  active,
  onOpen,
}: {
  entry: DirEntry;
  active: boolean;
  onOpen: (path: string) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [icon, setIcon] = useState<string | null>(null);

  // 이미지: 화면에 보일 때 지연 썸네일 추출(언마운트 시 revoke)
  useEffect(() => {
    if (entry.kind !== "image") return;
    const el = ref.current;
    if (!el) return;
    let url: string | null = null;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        io.disconnect();
        imageThumbnailUrl(entry.path)
          .then((u) => {
            url = u;
            setThumb(u);
          })
          .catch(() => {});
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      if (url) URL.revokeObjectURL(url);
    };
  }, [entry.path, entry.kind]);

  // 아카이브 등: 시스템 파일 아이콘(확장자별 캐시라 즉시·저비용)
  useEffect(() => {
    if (entry.kind === "image") return;
    let alive = true;
    systemIconUrl(entry.path)
      .then((u) => alive && setIcon(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [entry.path, entry.kind]);

  const openable = entry.kind === "archive";
  const preview = entry.kind === "image" ? thumb : icon;

  return (
    <button
      ref={ref}
      className={`file-row ${active ? "active" : ""} ${openable ? "" : "static"}`}
      onClick={openable ? () => onOpen(entry.path) : undefined}
      title={entry.name}
    >
      <span className="file-thumb">
        {preview ? <img src={preview} alt="" /> : <span className="file-thumb-ph" />}
      </span>
      <span className="file-name">{entry.name}</span>
    </button>
  );
}

/** 긴 경로는 앞을 …로 줄인다. */
function shorten(p: string, max = 40): string {
  return p.length <= max ? p : "…" + p.slice(p.length - max + 1);
}
