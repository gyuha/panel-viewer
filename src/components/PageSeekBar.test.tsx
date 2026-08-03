import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PageSeekBar } from "./PageSeekBar";

/** page는 0-based, 화면 표시는 1-based. */
function setup(page = 61, pageCount = 97) {
  const onSeek = vi.fn();
  const onClose = vi.fn();
  render(
    <PageSeekBar page={page} pageCount={pageCount} onSeek={onSeek} onClose={onClose} />,
  );
  const range = screen.getByLabelText("페이지 탐색") as HTMLInputElement;
  return { onSeek, onClose, range };
}

describe("PageSeekBar (페이지 탐색 바)", () => {
  it("0-based 인덱스를 1-based로 표시한다", () => {
    setup(61, 97);
    expect(screen.getByText("62 / 97")).toBeInTheDocument();
  });

  it("슬라이더 범위는 0..pageCount-1", () => {
    const { range } = setup(0, 97);
    expect(range.min).toBe("0");
    expect(range.max).toBe("96");
  });

  it("슬라이더를 움직이면 그 인덱스로 즉시 이동한다(실시간 스크럽)", () => {
    const { onSeek, range } = setup();
    fireEvent.change(range, { target: { value: "10" } });
    expect(onSeek).toHaveBeenCalledWith(10);
  });

  it("Esc는 이 바만 닫는다", () => {
    const { onClose, range } = setup();
    fireEvent.keyDown(range, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("바 바깥(backdrop) 클릭은 닫고, 바 안쪽 클릭은 닫지 않는다", () => {
    const { onClose, range } = setup();
    fireEvent.click(range);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector(".seek-backdrop")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
