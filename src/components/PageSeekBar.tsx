import { useEffect, useState } from "react";

interface PageSeekBarProps {
  page: number;
  pageCount: number;
  onSeek: (page: number) => void;
  onClose: () => void;
}

/**
 * 페이지 탐색 바. 뷰어 영역 가운데에 뜨는 반투명 슬림 바로, 슬라이더를 끄는 동안
 * 실시간으로 페이지가 이동한다(스크럽). 배경을 덮지 않아 이동이 그대로 보인다.
 * 투명 backdrop이 뒤의 클릭·휠을 막고, 그 바깥을 클릭하면 닫힌다.
 */
export function PageSeekBar({ page, pageCount, onSeek, onClose }: PageSeekBarProps) {
  // 드래그 중엔 로컬 값을 쓴다 — 연속 모드의 IntersectionObserver가 되쏘는 page 때문에
  // 핸들이 튀는 것을 막기 위함. 드래그가 아닐 땐 page를 따라가 휠·키 이동도 반영한다.
  const [dragging, setDragging] = useState(false);
  const [dragValue, setDragValue] = useState(page);

  // Esc로 이 바만 닫는다. capture로 먼저 잡아 뒤로 새지 않게 한다 — 그냥 두면
  // Viewer의 Esc가 파일을 통째로 닫는다(SettingsModal이 같은 이유로 쓰는 방어).
  // Escape 외의 키는 건드리지 않아 슬라이더의 네이티브 화살표 조작이 살아 있다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // 슬라이더 밖에서 손을 떼도 드래그가 끝나도록 window에서 받는다.
  useEffect(() => {
    if (!dragging) return;
    const up = () => setDragging(false);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [dragging]);

  const value = dragging ? dragValue : page;

  return (
    <div className="seek-backdrop" onClick={onClose}>
      <div className="seek-bar" onClick={(e) => e.stopPropagation()}>
        <input
          className="seek-range"
          type="range"
          min={0}
          max={Math.max(0, pageCount - 1)}
          value={value}
          aria-label="페이지 탐색"
          autoFocus
          onPointerDown={() => {
            setDragValue(page);
            setDragging(true);
          }}
          onChange={(e) => {
            const next = Number(e.target.value);
            setDragValue(next);
            onSeek(next);
          }}
        />
        <span className="seek-num">
          {value + 1} / {pageCount}
        </span>
      </div>
    </div>
  );
}
