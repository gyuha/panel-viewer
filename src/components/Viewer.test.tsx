import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { DEFAULT_CUSTOM } from "../lib/keymap";
import { Viewer } from "./Viewer";

// pageUrl은 Tauri 런타임(convertFileSrc)에 의존하므로 테스트에선 갈아끼운다.
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  pageUrl: (i: number, t: string) => `test://page/${i}?v=${t}`,
}));

const noop = () => {};

function setup(
  over: {
    seekOpen?: boolean;
    alwaysOnTop?: boolean;
    cursorAutoHide?: boolean;
    cursorHideDelay?: number;
  } = {},
) {
  const seekOpen = over.seekOpen ?? false;
  const alwaysOnTop = over.alwaysOnTop ?? false;
  // 기본은 꺼짐 — 커서 숨김을 다루지 않는 테스트에 1초짜리 타이머가 걸리지 않게 한다.
  const cursorAutoHide = over.cursorAutoHide ?? false;
  const onPageChange = vi.fn();
  const onSeekOpenChange = vi.fn();
  const onClose = vi.fn();
  const onToggleAlwaysOnTop = vi.fn();
  const { container } = render(
    <Viewer
      name="원피스-002.cbz"
      pageCount={97}
      page={61}
      mode="page"
      token="1"
      pageFit="screen"
      continuousFit="width"
      seamless={false}
      cursorAutoHide={cursorAutoHide}
      cursorHideDelay={over.cursorHideDelay ?? 1}
      customKeys={DEFAULT_CUSTOM}
      // 항상 true — 차단은 Viewer가 seekOpen으로 스스로 해야 한다.
      // (여기서 !seekOpen을 넣으면 Viewer가 게이트를 빠뜨려도 테스트가 통과해 허수가 된다.)
      shortcutsEnabled
      seekOpen={seekOpen}
      onSeekOpenChange={onSeekOpenChange}
      panelHidden={false}
      onTogglePanel={noop}
      alwaysOnTop={alwaysOnTop}
      onToggleAlwaysOnTop={onToggleAlwaysOnTop}
      hasPrevFile={false}
      hasNextFile={false}
      onPrevFile={noop}
      onNextFile={noop}
      onOpenAdjacent={noop}
      onPageChange={onPageChange}
      onModeChange={noop}
      onClose={onClose}
    />,
  );
  return { onPageChange, onSeekOpenChange, onClose, onToggleAlwaysOnTop, container };
}

describe("Viewer — 페이지 탐색 바 배선", () => {
  beforeEach(() => vi.clearAllMocks());

  it("카운터를 누르면 탐색 바가 열린다", () => {
    const { onSeekOpenChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: "62 / 97" }));
    expect(onSeekOpenChange).toHaveBeenCalledWith(true);
  });

  it("바가 닫혀 있으면 → 키가 평소대로 페이지를 넘긴다", () => {
    const { onPageChange } = setup();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(62);
  });

  it("바가 열려 있으면 → 화살표 키가 페이지를 넘기지 않는다(이중 발동 방지)", () => {
    // window 리스너는 포커스를 안 보므로, 차단이 없으면 슬라이더 1칸 + nextPage()가
    // 함께 발동해 한 번 눌러 두 장이 넘어간다.
    const { onPageChange } = setup({ seekOpen: true });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("바가 열려 있을 때 Esc는 바만 닫고 파일을 닫지 않는다", () => {
    const { onSeekOpenChange, onClose } = setup({ seekOpen: true });
    fireEvent.keyDown(screen.getByLabelText("페이지 탐색"), { key: "Escape" });
    expect(onSeekOpenChange).toHaveBeenCalledWith(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("바가 닫혀 있을 때 Esc는 기존대로 파일을 닫는다(회귀 방지)", () => {
    const { onClose } = setup();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Viewer — 항상 위 버튼", () => {
  beforeEach(() => vi.clearAllMocks());

  it("버튼을 누르면 토글 콜백이 불린다", () => {
    const { onToggleAlwaysOnTop } = setup();
    fireEvent.click(screen.getByRole("button", { name: "항상 위" }));
    expect(onToggleAlwaysOnTop).toHaveBeenCalledTimes(1);
  });

  it("꺼져 있으면 켜짐 표시가 없다", () => {
    setup();
    expect(screen.getByRole("button", { name: "항상 위" }).className).not.toContain("active");
  });

  it("켜져 있으면 켜짐 표시가 붙는다", () => {
    setup({ alwaysOnTop: true });
    expect(screen.getByRole("button", { name: "항상 위" }).className).toContain("active");
  });
});

describe("Viewer — 커서 자동 숨김", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const root = (container: HTMLElement) => container.querySelector(".viewer")!;
  const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

  it("지연이 지나면 루트에 cursor-hidden이 붙고, 꺼져 있으면 붙지 않는다", () => {
    const { container } = setup({ cursorAutoHide: true, cursorHideDelay: 1 });
    expect(root(container).className).not.toContain("cursor-hidden");
    wait(999);
    expect(root(container).className).not.toContain("cursor-hidden");
    wait(1);
    expect(root(container).className).toContain("cursor-hidden");

    const off = setup({ cursorAutoHide: false });
    wait(5000);
    expect(root(off.container).className).not.toContain("cursor-hidden");
  });

  it("숨은 뒤 클릭·휠·같은 좌표 mousemove는 커서를 되살리지 않고, 실제 이동만 되살린다", () => {
    // 같은 좌표 가드가 없으면 웹뷰가 스크롤·이미지 교체 때 합성해 쏘는 mousemove에
    // 커서가 되살아나 "휠을 해도 보이지 않게"가 조용히 깨진다.
    const { container } = setup({ cursorAutoHide: true, cursorHideDelay: 1 });
    fireEvent.mouseMove(window, { clientX: 10, clientY: 20 });
    wait(1000);
    expect(root(container).className).toContain("cursor-hidden");

    fireEvent.click(root(container));
    fireEvent.wheel(root(container), { deltaY: 120 });
    fireEvent.mouseMove(window, { clientX: 10, clientY: 20 }); // 좌표 동일 = 이동 아님
    expect(root(container).className).toContain("cursor-hidden");

    fireEvent.mouseMove(window, { clientX: 11, clientY: 20 }); // 실제 이동
    expect(root(container).className).not.toContain("cursor-hidden");
  });
});
