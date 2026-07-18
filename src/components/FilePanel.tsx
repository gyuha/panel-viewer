import { useCallback, useEffect, useRef, useState } from "react";
import {
  readDir,
  imageThumbnailUrl,
  systemIconUrl,
  type DirEntry,
  type DirListing,
} from "../lib/api";

interface FilePanelProps {
  openedPath: string | null;
  onOpenFile: (path: string) => void;
  initialFolder: string | null;
  onFolderChange: (folder: string) => void;
}

/** 왼쪽 파일 패널: 현재 폴더 한 단계(상위/하위 폴더 + 코믹 아카이브)를 평평한 목록으로. */
export function FilePanel({ openedPath, onOpenFile, initialFolder, onFolderChange }: FilePanelProps) {
  const [listing, setListing] = useState<DirListing | null>(null);
  const [error, setError] = useState<string | null>(null);

  const navigate = useCallback(
    async (path: string | null) => {
      try {
        const l = await readDir(path);
        setListing(l);
        setError(null);
        onFolderChange(l.current);
      } catch (e) {
        setError(String(e));
      }
    },
    [onFolderChange],
  );

  // 마운트 시 마지막 폴더(없으면 홈)로
  useEffect(() => {
    void navigate(initialFolder);
    // 최초 1회만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <aside className="panel">
      <div className="panel-path" title={listing?.current}>
        {listing ? shorten(listing.current) : "…"}
      </div>
      <div className="panel-list">
        {listing?.parent && (
          <button className="dir-row" onClick={() => navigate(listing.parent)}>
            <span className="dir-icon">↩</span>
            <span className="dir-name">상위 폴더</span>
          </button>
        )}
        {listing?.folders.map((f) => (
          <button key={f.path} className="dir-row" onClick={() => navigate(f.path)}>
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
