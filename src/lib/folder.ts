// 현재 폴더 안에서 파일을 찾는 순수 로직.
// macOS 파일 연결로 온 경로(NFC)와 read_dir 경로(NFD)가 문자열로 달라도 매칭되도록
// 파일명(basename)을 NFC로 정규화해 비교한다.

/** 경로의 마지막 조각(파일명). 구분자는 / 와 \ 모두 처리. */
export function basename(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}

/** archivePaths에서 target과 같은 파일의 인덱스(NFC 정규화 파일명 기준). 없으면 -1. */
export function indexInFolder(archivePaths: string[], target: string): number {
  const t = basename(target).normalize("NFC");
  return archivePaths.findIndex((p) => basename(p).normalize("NFC") === t);
}

/** 새 목록의 폴더들 중 방금 떠난 폴더(leftPath)의 경로. 없으면 null. 이름은 NFC 정규화로 비교. */
export function leftFolderPath(folders: { path: string }[], leftPath: string): string | null {
  const i = indexInFolder(
    folders.map((f) => f.path),
    leftPath,
  );
  return i >= 0 ? folders[i].path : null;
}
