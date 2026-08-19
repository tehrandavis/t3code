import { describe, expect, it } from "vite-plus/test";

import {
  browseRootParent,
  isProjectBrowseRoot,
  isShallowBrowseRoot,
  mentionDestination,
} from "./fileBrowserRoot";

describe("browseRootParent", () => {
  it("walks up one directory", () => {
    expect(browseRootParent("/Users/me/dev/repo")).toBe("/Users/me/dev");
    expect(browseRootParent("/Users/me/dev/repo/")).toBe("/Users/me/dev");
  });

  it("stops at the filesystem root", () => {
    expect(browseRootParent("/Users")).toBe("/");
    expect(browseRootParent("/")).toBe(null);
  });

  it("handles windows drive paths", () => {
    expect(browseRootParent("C:\\Users\\me\\repo")).toBe("C:\\Users\\me");
    expect(browseRootParent("C:\\")).toBe(null);
  });
});

describe("isShallowBrowseRoot", () => {
  it("flags roots at or above a home directory", () => {
    expect(isShallowBrowseRoot("/")).toBe(true);
    expect(isShallowBrowseRoot("/Users")).toBe(true);
    expect(isShallowBrowseRoot("/Users/me")).toBe(true);
    expect(isShallowBrowseRoot("C:\\Users\\me")).toBe(true);
  });

  it("leaves deeper roots alone", () => {
    expect(isShallowBrowseRoot("/Users/me/dev")).toBe(false);
    expect(isShallowBrowseRoot("/Users/me/dev/repo")).toBe(false);
  });
});

describe("isProjectBrowseRoot", () => {
  it("ignores trailing separators", () => {
    expect(isProjectBrowseRoot("/repo", "/repo/")).toBe(true);
    expect(isProjectBrowseRoot("/repo", "/repo/src")).toBe(false);
  });
});

describe("mentionDestination", () => {
  const projectCwd = "/Users/me/dev/repo";

  it("keeps the entry path when the tree is showing the project", () => {
    expect(
      mentionDestination({
        projectCwd,
        browseRoot: "/Users/me/dev/repo/",
        relativePath: "src/a.ts",
      }),
    ).toBe("src/a.ts");
  });

  it("walks up for a file outside the project", () => {
    expect(
      mentionDestination({
        projectCwd,
        browseRoot: "/Users/me/dev",
        relativePath: "notes/todo.md",
      }),
    ).toBe("../notes/todo.md");
  });

  it("walks up several levels", () => {
    expect(
      mentionDestination({ projectCwd, browseRoot: "/Users/me", relativePath: "todo.md" }),
    ).toBe("../../todo.md");
  });

  it("re-enters the project when browsing from above it", () => {
    expect(
      mentionDestination({
        projectCwd,
        browseRoot: "/Users/me/dev",
        relativePath: "repo/src/a.ts",
      }),
    ).toBe("src/a.ts");
  });

  it("falls back to the absolute path across windows drives", () => {
    expect(
      mentionDestination({
        projectCwd: "C:\\dev\\repo",
        browseRoot: "D:\\notes",
        relativePath: "todo.md",
      }),
    ).toBe("D:\\notes\\todo.md");
  });
});
