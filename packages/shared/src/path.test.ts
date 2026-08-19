import { describe, expect, it } from "vite-plus/test";
import {
  isExplicitRelativePath,
  joinWorkspacePath,
  isUncPath,
  isWindowsAbsolutePath,
  isWindowsDrivePath,
  normalizeProjectPathForComparison,
  normalizeProjectPathForDispatch,
  relativeWorkspacePath,
} from "./path.ts";

describe("path helpers", () => {
  it("detects windows drive paths", () => {
    expect(isWindowsDrivePath("C:\\repo")).toBe(true);
    expect(isWindowsDrivePath("D:/repo")).toBe(true);
    expect(isWindowsDrivePath("/repo")).toBe(false);
  });

  it("detects UNC paths", () => {
    expect(isUncPath("\\\\server\\share\\repo")).toBe(true);
    expect(isUncPath("C:\\repo")).toBe(false);
  });

  it("detects windows absolute paths", () => {
    expect(isWindowsAbsolutePath("C:\\repo")).toBe(true);
    expect(isWindowsAbsolutePath("\\\\server\\share\\repo")).toBe(true);
    expect(isWindowsAbsolutePath("./repo")).toBe(false);
  });

  it("detects explicit relative paths", () => {
    expect(isExplicitRelativePath(".")).toBe(true);
    expect(isExplicitRelativePath("..")).toBe(true);
    expect(isExplicitRelativePath("./repo")).toBe(true);
    expect(isExplicitRelativePath("..\\repo")).toBe(true);
    expect(isExplicitRelativePath("~/repo")).toBe(false);
  });

  it("normalizes a bare Windows drive root the same as one with a trailing separator", () => {
    // `C:`, `C:\` and `C:/` all refer to the drive root and must compare equal.
    expect(normalizeProjectPathForDispatch("C:")).toBe("C:\\");
    expect(normalizeProjectPathForComparison("C:")).toBe("c:\\");
    expect(normalizeProjectPathForComparison("C:")).toBe(normalizeProjectPathForComparison("C:\\"));
    expect(normalizeProjectPathForComparison("C:")).toBe(normalizeProjectPathForComparison("C:/"));
    // Non-root drive paths keep their trailing separator trimmed as before.
    expect(normalizeProjectPathForDispatch("C:\\repo\\")).toBe("C:\\repo");
  });
});

describe("joinWorkspacePath", () => {
  it("joins with the root's separator style", () => {
    expect(joinWorkspacePath("/repo", "src/index.ts")).toBe("/repo/src/index.ts");
    expect(joinWorkspacePath("/repo/", "src/index.ts")).toBe("/repo/src/index.ts");
    expect(joinWorkspacePath("C:\\repo", "src/index.ts")).toBe("C:\\repo\\src\\index.ts");
  });

  it("returns the root for an empty relative path", () => {
    expect(joinWorkspacePath("/repo/", "")).toBe("/repo");
  });
});

describe("relativeWorkspacePath", () => {
  it("matches the workspace-relative path when the target is inside the root", () => {
    expect(relativeWorkspacePath("/repo", "/repo/src/index.ts")).toBe("src/index.ts");
  });

  it("walks up for a target outside the root", () => {
    expect(relativeWorkspacePath("/home/me/repo", "/home/me/notes/todo.md")).toBe(
      "../notes/todo.md",
    );
    expect(relativeWorkspacePath("/home/me/dev/repo", "/home/me/todo.md")).toBe("../../todo.md");
  });

  it("returns '.' when the paths are the same", () => {
    expect(relativeWorkspacePath("/repo", "/repo/")).toBe(".");
  });

  it("compares windows segments case-insensitively and emits posix separators", () => {
    expect(relativeWorkspacePath("C:\\Repo\\app", "c:\\repo\\notes\\todo.md")).toBe(
      "../notes/todo.md",
    );
  });

  it("returns null across windows drives", () => {
    expect(relativeWorkspacePath("C:\\repo", "D:\\notes\\todo.md")).toBe(null);
  });

  it("returns null across UNC shares and between path kinds", () => {
    expect(relativeWorkspacePath("\\\\server\\share\\repo", "\\\\server\\other\\todo.md")).toBe(
      null,
    );
    expect(relativeWorkspacePath("/repo", "C:\\notes\\todo.md")).toBe(null);
  });

  it("relates paths within one UNC share", () => {
    expect(relativeWorkspacePath("\\\\server\\share\\repo", "\\\\server\\share\\todo.md")).toBe(
      "../todo.md",
    );
  });

  it("returns null for a relative input", () => {
    expect(relativeWorkspacePath("./repo", "/repo/src/index.ts")).toBe(null);
  });
});
