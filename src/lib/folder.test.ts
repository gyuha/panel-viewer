import { describe, it, expect } from "vitest";
import { basename, indexInFolder } from "./folder";

describe("basename", () => {
  it("posix/windows 구분자에서 마지막 조각", () => {
    expect(basename("/a/b/c.cbz")).toBe("c.cbz");
    expect(basename("C:\\a\\b.cbr")).toBe("b.cbr");
    expect(basename("x.zip")).toBe("x.zip");
  });
});

describe("indexInFolder", () => {
  const list = ["/f/1.cbz", "/f/2.cbz", "/f/10.cbz"];

  it("정상 매칭", () => {
    expect(indexInFolder(list, "/f/2.cbz")).toBe(1);
    expect(indexInFolder(list, "/f/10.cbz")).toBe(2);
  });

  it("목록에 없으면 -1", () => {
    expect(indexInFolder(list, "/f/x.cbz")).toBe(-1);
  });

  it("한글 파일명 NFD/NFC 불일치도 매칭한다(macOS 파일연결 경로 vs read_dir)", () => {
    const nfc = "가나다.cbz".normalize("NFC");
    const nfd = "가나다.cbz".normalize("NFD");
    expect(nfc).not.toBe(nfd); // 문자열로는 서로 다름
    // 목록은 NFD(read_dir), 대상은 NFC(Opened 이벤트) — 폴더가 달라도 basename 정규화로 매칭
    expect(indexInFolder([`/read/${nfd}`], `/opened/${nfc}`)).toBe(0);
  });
});
