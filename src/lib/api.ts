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
}

export interface DirEntry {
  name: string;
  path: string;
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

/** 현재 열린 아카이브의 index번째 페이지 이미지 URL(커스텀 프로토콜, 플랫폼별 형식 자동). */
export function pageUrl(index: number): string {
  return convertFileSrc(String(index), "pvpage");
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

/** 폴더 한 단계(하위 폴더 + 코믹 아카이브)를 읽는다. null이면 홈 디렉터리. */
export function readDir(path: string | null): Promise<DirListing> {
  return invoke<DirListing>("read_dir", { path });
}

/** 커버 썸네일 JPEG를 blob URL로 만들어 반환한다(호출자가 revoke). */
export async function coverThumbnailUrl(path: string): Promise<string> {
  const bytes = await invoke<number[]>("cover_thumbnail", { path });
  const blob = new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
  return URL.createObjectURL(blob);
}

/** OS 파일 연결로 넘어온 대기 파일을 한 번 가져간다. */
export function takePendingFile(): Promise<string | null> {
  return invoke<string | null>("take_pending_file");
}
