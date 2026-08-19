/**
 * Root handling for the Files panel.
 *
 * The panel lists one directory tree at a time. That directory starts as the
 * project's workspace root and moves when the user browses out of it, so these
 * helpers answer the three questions the move raises: where does "up" go, is
 * the destination big enough to warn about, and what path should a mention
 * carry once the tree is no longer showing the project.
 */
import {
  joinWorkspacePath,
  normalizeProjectPathForDispatch,
  relativeWorkspacePath,
  workspacePathDepth,
} from "@t3tools/shared/path";

import { getBrowseParentPath } from "~/lib/projectPaths";

/**
 * Directories at or above this depth hold too much to scan comfortably: `/`,
 * `/Users`, and a home directory such as `/Users/me` all sit here.
 */
const SHALLOW_ROOT_MAX_DEPTH = 2;

export function normalizeBrowseRoot(root: string): string {
  return normalizeProjectPathForDispatch(root.trim());
}

/** The parent of `root`, or `null` at the filesystem root. */
export function browseRootParent(root: string): string | null {
  const parent = getBrowseParentPath(normalizeBrowseRoot(root));
  if (parent === null) return null;
  const normalized = normalizeBrowseRoot(parent);
  return normalized === normalizeBrowseRoot(root) ? null : normalized;
}

/**
 * Whether listing `root` should ask first. A shallow root has no gitignore
 * pruning to keep the scan cheap and will usually truncate.
 */
export function isShallowBrowseRoot(root: string): boolean {
  const depth = workspacePathDepth(normalizeBrowseRoot(root));
  return depth !== null && depth <= SHALLOW_ROOT_MAX_DEPTH;
}

export function isProjectBrowseRoot(projectCwd: string, browseRoot: string): boolean {
  return normalizeBrowseRoot(projectCwd) === normalizeBrowseRoot(browseRoot);
}

/**
 * The path a composer mention should carry for a tree entry.
 *
 * Mentions are measured from the project, because that is where the agent
 * runs. Inside the project this is the entry's own path. Outside it walks up
 * with `..`, and falls back to the absolute path where no relative path
 * exists, such as across two Windows drives.
 */
export function mentionDestination(input: {
  readonly projectCwd: string;
  readonly browseRoot: string;
  readonly relativePath: string;
}): string {
  if (isProjectBrowseRoot(input.projectCwd, input.browseRoot)) {
    return input.relativePath;
  }
  const absolutePath = joinWorkspacePath(input.browseRoot, input.relativePath);
  return relativeWorkspacePath(input.projectCwd, absolutePath) ?? absolutePath;
}
