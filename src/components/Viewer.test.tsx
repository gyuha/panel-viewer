import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DEFAULT_CUSTOM } from "../lib/keymap";
import { Viewer } from "./Viewer";

// pageUrl은 Tauri 런타임(convertFileSrc)에 의존하므로 테스트에선 갈아끼운다.
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  pageUrl: (i: number, t: string) => `test://page/${i}?v=${t}`,
}));

const noop = () => {};

function setup(over: { seekOpen?: boolean } = {}) {
  const seekOpen = over.seekOpen ?? false;
  const onPageChange = vi.fn();
  const onSeekOpenChange = vi.fn();
  const onClose = vi.fn();
  render(
    <Viewer
      name="원피스-002.cbz"
      pageCount={97}
      page={61}
      mode="page"
      token="1"
      pageFit="screen"
      continuousFit="width"
      seamless={false}
      customKeys={DEFAULT_CUSTOM}
      // 항상 true — 차단은 Viewer가 seekOpen으로 스스로 해야 한다.
      // (여기서 !seekOpen을 넣으면 Viewer가 게이트를 빠뜨려도 테스트가 통과해 허수가 된다.)
      shortcutsEnabled
      seekOpen={seekOpen}
      onSeekOpenChange={onSeekOpenChange}
      panelHidden={false}
      onTogglePanel={noop}
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
  return { onPageChange, onSeekOpenChange, onClose };
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
