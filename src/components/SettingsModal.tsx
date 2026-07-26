import { useEffect, useState } from "react";
import {
  ACTIONS,
  ACTION_LABELS,
  STANDARD_KEYS,
  eventKey,
  findConflict,
  isAssignableKey,
  keyLabel,
  type Action,
  type CustomKeys,
} from "../lib/keymap";
import type { PageFit, ContinuousFit } from "../lib/api";

interface SettingsModalProps {
  customKeys: CustomKeys;
  onSet: (action: Action, key: string) => void;
  onReset: () => void;
  pageFit: PageFit;
  continuousFit: ContinuousFit;
  onSetPageFit: (fit: PageFit) => void;
  onSetContinuousFit: (fit: ContinuousFit) => void;
  openLastFile: boolean;
  seamless: boolean;
  onSetOpenLastFile: (enabled: boolean) => void;
  onSetSeamless: (enabled: boolean) => void;
  onClose: () => void;
}

const PAGE_FIT_OPTIONS: { key: PageFit; label: string }[] = [
  { key: "original", label: "원본" },
  { key: "width", label: "폭 맞추기" },
  { key: "height", label: "높이 맞추기" },
  { key: "screen", label: "화면에 맞추기" },
];

const CONTINUOUS_FIT_OPTIONS: { key: ContinuousFit; label: string }[] = [
  { key: "original", label: "원본" },
  { key: "width", label: "폭 맞추기" },
];

/** 세그먼트 형태의 단일 선택 컨트롤. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.key}
          className={`seg-btn ${value === o.key ? "active" : ""}`}
          role="radio"
          aria-checked={value === o.key}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type Tab = "general" | "page" | "continuous" | "shortcuts";

const TABS: { key: Tab; label: string }[] = [
  { key: "general", label: "일반" },
  { key: "page", label: "한장" },
  { key: "continuous", label: "연속" },
  { key: "shortcuts", label: "단축키" },
];

/** 설정 다이얼로그. 일반 · 한장 · 연속 · 단축키 탭으로 구성. */
export function SettingsModal({
  customKeys,
  onSet,
  onReset,
  pageFit,
  continuousFit,
  onSetPageFit,
  onSetContinuousFit,
  openLastFile,
  seamless,
  onSetOpenLastFile,
  onSetSeamless,
  onClose,
}: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>("general");
  const [capturing, setCapturing] = useState<Action | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // 캡처 중: 다음 키 입력을 잡아 커스텀 키로 지정(충돌 검사). 캡처 아닐 때: Esc로 이 다이얼로그만 닫기.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!capturing) {
        if (e.key === "Escape") {
          // 설정만 닫고 뒤(뷰어/전역)로 Esc가 전파되지 않게 차단 — 읽던 파일은 유지.
          e.stopPropagation();
          e.preventDefault();
          onClose();
        }
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setCapturing(null);
        setMessage(null);
        return;
      }
      if (!isAssignableKey(e)) {
        setMessage("조합키나 수식 키는 지정할 수 없습니다. 단일 키를 눌러주세요.");
        return;
      }
      const k = eventKey(e);
      const conflict = findConflict(capturing, k, customKeys);
      if (conflict) {
        setMessage(`'${keyLabel(k)}' 키는 이미 '${ACTION_LABELS[conflict]}'에 사용 중입니다.`);
        return;
      }
      onSet(capturing, k);
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
          <h2 className="modal-title">설정</h2>
          <button className="btn-ghost" onClick={onClose} title="닫기 (Esc)">
            ✕
          </button>
        </header>

        <nav className="tab-bar" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab-btn ${tab === t.key ? "active" : ""}`}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => {
                setTab(t.key);
                setCapturing(null);
                setMessage(null);
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "general" && (
          <div className="general-settings">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={openLastFile}
                onChange={(e) => onSetOpenLastFile(e.target.checked)}
              />
              <span>
                마지막 파일 열기
                <em className="toggle-desc">앱을 그냥 실행하면 마지막에 읽던 파일을 자동으로 엽니다.</em>
              </span>
            </label>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={seamless}
                onChange={(e) => onSetSeamless(e.target.checked)}
              />
              <span>
                파일 이어보기
                <em className="toggle-desc">
                  마지막 페이지에서 다음으로 넘기면 다음 파일을, 첫 페이지에서 이전으로 넘기면 이전 파일을 엽니다.
                </em>
              </span>
            </label>
          </div>
        )}

        {tab === "page" && (
          <div className="setting-row">
            <label className="setting-label">이미지 사이즈</label>
            <Segmented value={pageFit} options={PAGE_FIT_OPTIONS} onChange={onSetPageFit} />
          </div>
        )}

        {tab === "continuous" && (
          <div className="setting-row">
            <label className="setting-label">이미지 사이즈</label>
            <Segmented
              value={continuousFit}
              options={CONTINUOUS_FIT_OPTIONS}
              onChange={onSetContinuousFit}
            />
          </div>
        )}

        {tab === "shortcuts" && (
          <>
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

            <p className="modal-hint fixed-keys">
              고정 단축키: <kbd>⌘ ,</kbd> 메뉴 열기 · <kbd>Esc</kbd> 닫기
            </p>

            <footer className="modal-foot">
              <button className="btn-ghost" onClick={onReset}>
                기본값 복원
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
