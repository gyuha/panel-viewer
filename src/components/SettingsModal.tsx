import { useEffect, useState } from "react";
import {
  ACTIONS,
  ACTION_LABELS,
  STANDARD_KEYS,
  findConflict,
  isAssignableKey,
  type Action,
  type CustomKeys,
} from "../lib/keymap";

interface SettingsModalProps {
  customKeys: CustomKeys;
  onSet: (action: Action, key: string) => void;
  onReset: () => void;
  onClose: () => void;
}

/** 눌린 키를 사람이 읽는 라벨로. */
function keyLabel(k: string): string {
  const map: Record<string, string> = {
    " ": "Space",
    ArrowRight: "→",
    ArrowLeft: "←",
    ArrowUp: "↑",
    ArrowDown: "↓",
    PageUp: "PageUp",
    PageDown: "PageDown",
  };
  return map[k] ?? k;
}

/** 단축키 설정 모달. 각 동작의 표준 키(고정)와 편집 가능한 커스텀 키 1개를 보여준다. */
export function SettingsModal({ customKeys, onSet, onReset, onClose }: SettingsModalProps) {
  const [capturing, setCapturing] = useState<Action | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // 캡처 중: 다음 키 입력을 잡아 커스텀 키로 지정(충돌 검사). 캡처 아닐 때: Esc로 모달 닫기.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!capturing) {
        if (e.key === "Escape") onClose();
        return;
      }
      e.preventDefault();
      if (e.key === "Escape") {
        setCapturing(null);
        setMessage(null);
        return;
      }
      if (!isAssignableKey(e)) {
        setMessage("조합키나 수식 키는 지정할 수 없습니다. 단일 키를 눌러주세요.");
        return;
      }
      const conflict = findConflict(capturing, e.key, customKeys);
      if (conflict) {
        setMessage(`'${keyLabel(e.key)}' 키는 이미 '${ACTION_LABELS[conflict]}'에 사용 중입니다.`);
        return;
      }
      onSet(capturing, e.key);
      setCapturing(null);
      setMessage(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing, customKeys, onSet, onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2 className="modal-title">단축키 설정</h2>
          <button className="btn-ghost" onClick={onClose} title="닫기 (Esc)">
            ✕
          </button>
        </header>

        <p className="modal-hint">
          표준 키는 항상 동작하며 바꿀 수 없습니다. 각 동작에 커스텀 키 1개를 추가로 지정할 수 있습니다.
        </p>

        <table className="keymap-table">
          <thead>
            <tr>
              <th>동작</th>
              <th>표준 키</th>
              <th>커스텀 키</th>
            </tr>
          </thead>
          <tbody>
            {ACTIONS.map((a) => (
              <tr key={a}>
                <td>{ACTION_LABELS[a]}</td>
                <td className="std-keys">
                  {STANDARD_KEYS[a].length
                    ? STANDARD_KEYS[a].map(keyLabel).join(" · ")
                    : "—"}
                </td>
                <td>
                  <button
                    className={`custom-key ${capturing === a ? "capturing" : ""}`}
                    onClick={() => {
                      setCapturing(a);
                      setMessage(null);
                    }}
                  >
                    {capturing === a
                      ? "키를 누르세요…"
                      : customKeys[a]
                        ? keyLabel(customKeys[a])
                        : "없음"}
                  </button>
                  {customKeys[a] && capturing !== a && (
                    <button
                      className="custom-key-clear"
                      title="커스텀 키 지우기"
                      onClick={() => onSet(a, "")}
                    >
                      ✕
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {message && <p className="modal-error">{message}</p>}

        <footer className="modal-foot">
          <button className="btn-ghost" onClick={onReset}>
            기본값 복원
          </button>
        </footer>
      </div>
    </div>
  );
}
