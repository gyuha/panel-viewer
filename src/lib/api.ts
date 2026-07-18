import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import type { ViewMode } from "./nav";

export interface ArchiveInfo {
  name: string;
  pageCount: number;
}

export interface PersistedState {
  lastFolder: string | null;
  viewMode: ViewMode;
  readingPositions: Record<string, number>;
  keybindings: Record<string, string>;
  panelHidden: boolean;
  windowSize: { width: number; height: number } | null;
}

export type EntryKind = "folder" | "archive" | "image";

export interface DirEntry {
  name: string;
  path: string;
  kind: EntryKind;
}

export interface DirListing {
  current: string;
  parent: string | null;
  folders: DirEntry[];
  files: DirEntry[];
}

/** 아카이브를 열고 페이지 개수 등 정보를 받는다. */
export function openArchive(path: string): Promise<ArchiveInfo> {
  return invoke<ArchiveInfo>("open_archive", { path });
}

/**
 * 현재 열린 아카이브의 index번째 페이지 이미지 URL(커스텀 프로토콜, 플랫폼별 형식 자동).
 * token은 파일별로 달라지는 캐시버스팅 값 — 파일을 바꾸면 URL이 달라져 웹뷰가 이전 파일의
 * 캐시 이미지를 재사용하지 않고 새로 로드한다(같은 index라도 파일이 다르면 다른 URL).
 */
export function pageUrl(index: number, token: string): string {
  return `${convertFileSrc(String(index), "pvpage")}?v=${encodeURIComponent(token)}`;
}

/** 영속 상태 전체를 읽어온다. */
export function loadState(): Promise<PersistedState> {
  return invoke<PersistedState>("load_state");
}

/** 파일별 읽던 위치를 저장한다. */
export function saveReadingPosition(path: string, page: number): Promise<void> {
  return invoke("save_reading_position", { path, page });
}

/** 마지막 보기 모드를 저장한다. */
export function saveViewMode(mode: ViewMode): Promise<void> {
  return invoke("save_view_mode", { mode });
}

/** 마지막으로 탐색한 폴더를 저장한다. */
export function saveLastFolder(folder: string): Promise<void> {
  return invoke("save_last_folder", { folder });
}

/** 단축키 커스텀 키 맵(동작명→키)을 저장한다. */
export function saveKeybindings(bindings: Record<string, string>): Promise<void> {
  return invoke("save_keybindings", { bindings });
}

/** 파일 패널 숨김 상태를 저장한다. */
export function savePanelHidden(hidden: boolean): Promise<void> {
  return invoke("save_panel_hidden", { hidden });
}

/** 창 크기(논리 픽셀)를 저장한다. 복원은 백엔드 setup()이 담당. */
export function saveWindowSize(width: number, height: number): Promise<void> {
  return invoke("save_window_size", { width, height });
}

/** 폴더 한 단계(하위 폴더 + 코믹 아카이브)를 읽는다. null이면 홈 디렉터리. */
export function readDir(path: string | null): Promise<DirListing> {
  return invoke<DirListing>("read_dir", { path });
}

/** 이미지 파일의 썸네일 JPEG를 blob URL로 만들어 반환한다(호출자가 revoke). */
export async function imageThumbnailUrl(path: string): Promise<string> {
  const bytes = await invoke<number[]>("image_thumbnail", { path });
  const blob = new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
  return URL.createObjectURL(blob);
}

// 시스템 파일 아이콘은 확장자별로 동일하므로 확장자 단위로 캐시한다(확장자당 백엔드 1회 호출).
const iconCache = new Map<string, Promise<string>>();

/** 파일의 실제 OS 아이콘 blob URL(확장자별 캐시, revoke하지 않고 세션 내 공유). */
export function systemIconUrl(path: string): Promise<string> {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  let cached = iconCache.get(ext);
  if (!cached) {
    cached = invoke<number[]>("system_icon", { path }).then((bytes) => {
      const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
      return URL.createObjectURL(blob);
    });
    iconCache.set(ext, cached);
  }
  return cached;
}

/** OS 파일 연결로 넘어온 대기 파일을 한 번 가져간다. */
export function takePendingFile(): Promise<string | null> {
  return invoke<string | null>("take_pending_file");
}

/** 앱을 종료한다. */
export function quitApp(): Promise<void> {
  return invoke("quit_app");
}
