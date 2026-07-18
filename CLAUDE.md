# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Panel Viewer is a **Tauri 2 + React + TypeScript** desktop comic/webtoon reader for `cbz`/`cbr`/`zip` archives. Development and verification target **macOS first** (Tauri config is cross-platform, but only macOS is exercised).

## Commands

Tasks are driven by [`Taskfile.yml`](Taskfile.yml) (go-task, `brew install go-task`). `task` alone lists them.

- `task setup` — `npm install` (run once; other tasks refuse to run without `node_modules`)
- `task dev` — run the app (Tauri dev, hot reload). **The only way to exercise GUI behavior.**
- `task build:app` — build the `.app` bundle only. **Use this, not `task build`**: the full `task build` (= `npm run tauri build`) fails at the DMG step in headless environments (`bundle_dmg.sh` needs a GUI/Finder session); the `.app` and release binary build fine.
- `task check` — `tsc --noEmit` + `cargo check`
- `task test` — full suite (Vitest + `cargo test`)
- Single test — frontend: `npx vitest run src/lib/nav.test.ts`; Rust: `cd src-tauri && cargo test <name>` (e.g. `cargo test natural_sort`)
- `task fmt` / `task lint` — `cargo fmt` / `cargo clippy` (clippy needs `rustup component add clippy`)

## Architecture

Two halves talk **only** through Tauri: the frontend calls Rust via `src/lib/api.ts`, and the backend serves page images via a custom URI scheme. Understand these seams before changing either side.

### Rust backend (`src-tauri/src/`)
- `lib.rs` — wires everything: registers all `#[tauri::command]`s, the `pvpage://` protocol, and macOS file-association handling. Holds two pieces of Tauri-managed state: the **current archive session** (`Mutex<Session>` = path + ordered page list, set by `open_archive`) and the **persisted state store** (`Mutex<StateStore>`).
- `archive.rs` — the tested core. Lists image entries (natural-sorted) and extracts one page's bytes from zip (`zip` crate) or rar (`unrar` crate). Archive type is decided by **magic bytes, not extension** (a `.cbz` that is really RAR still works). See `.forge/adr/*-cbr-unrar-crate.md` for why `unrar` (RAR5 support) over pure-Rust crates.
- `fs.rs` — one-level folder listing; returns folders + archives + image files, each tagged with a `kind` (`folder`/`archive`/`image`) the frontend uses to decide thumbnail vs icon.
- `state.rs` — JSON persistence (reading position per file, view mode, last folder) in the app data dir. Loads are corruption-proof (bad/missing JSON → defaults).
- `thumbnail.rs` — decode+resize+disk-cache a thumbnail for **image files** (archives do not get cover thumbnails).

### Frontend (`src/`)
- `lib/api.ts` — the single bridge to Rust. Every `invoke` and every backend-URL builder lives here; components never call `invoke` directly.
- `lib/nav.ts` — pure page-math (`clampPage`/`nextPage`/`prevPage`), unit-tested by `nav.test.ts` (the only Vitest suite).
- `App.tsx` — owns all cross-cutting state (opened archive, current page, view mode, sibling file list, cache-bust token) and the central `openPath` flow. `FilePanel` (left), `Viewer` (right toolbar + mode switch → `PageView` or `ContinuousView`) are presentational-ish children.

### Non-obvious invariants (do not regress these)
- **Page images are served over the `pvpage://localhost/<index>` custom protocol**, not by returning bytes from a command. The protocol handler serves `pages[index]` of the *current* session — so the URL encodes only the index, not which file.
- **Because of that, page URLs must carry a cache-bust token** (`pageUrl(index, token)` → `pvpage://localhost/<index>?v=<token>`, token bumped per open). Without it, switching files reuses the previous file's cached image for the same index. This was a real bug; keep the token.
- **`system_icon` passes a synthetic ASCII path** (`icon.<ext>`) to the `systemicons` crate instead of the real path: that crate mishandles non-ASCII (e.g. Korean) paths, and file icons depend only on the extension. The frontend caches icons by extension (one backend call per extension).
- **`ViewMode` has only `page` / `continuous`.** Old persisted `ltr`/`rtl` values migrate to `page` via serde `alias` in `state.rs` — preserve that alias so existing `state.json` (with reading positions) still loads.
- **`openPath` is re-entrancy-guarded** (`opening` ref) so overlapping async opens (rapid file navigation) can't interleave state.
- **macOS file open**: launch arg (`std::env::args`) + `RunEvent::Opened` set a pending-file that the frontend drains via `take_pending_file` + an `open-archive` event. `.cbz`/`.cbr` associations are declared in `tauri.conf.json` `bundle.fileAssociations`.

## Testing reality

Rust logic is unit-tested inline (`#[cfg(test)]`) against `src-tauri/tests/fixtures/` (`sample.cbr` is committed; zip fixtures are generated in-test). Frontend tests cover only pure logic in `lib/`. **GUI interaction is not machine-testable** here (no macOS Tauri E2E), so behavior like actual rendering, drag-and-drop, and file navigation must be verified by hand with `task dev`.

## Project docs

Domain terms live in `.forge/CONTEXT.md`; hard-to-reverse decisions are recorded in `.forge/adr/`. Consult them before renaming concepts or swapping load-bearing libraries.
