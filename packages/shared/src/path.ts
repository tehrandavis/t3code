export function isWindowsDrivePath(value: string): boolean {
  return /^[a-zA-Z]:([/\\]|$)/.test(value);
}

export function isUncPath(value: string): boolean {
  return value.startsWith("\\\\");
}

export function isWindowsAbsolutePath(value: string): boolean {
  return isUncPath(value) || isWindowsDrivePath(value);
}

export function isExplicitRelativePath(value: string): boolean {
  return (
    value === "." ||
    value === ".." ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith(".\\") ||
    value.startsWith("..\\")
  );
}

function isRootPath(value: string): boolean {
  // The drive separator is required: a bare `C:` is not the drive root (it
  // means "current directory on C:"), and treating it as already-canonical
  // would leave it as `C:` while `C:\` and `C:/` normalize to the drive root,
  // so the same location would fail project identity/dedup comparisons.
  return value === "/" || value === "\\" || /^[a-zA-Z]:[/\\]$/.test(value);
}

function trimTrailingPathSeparators(value: string): string {
  if (value.length === 0 || isRootPath(value)) {
    return value;
  }
  const trimmed = value.startsWith("/")
    ? value.replace(/\/+$/g, "")
    : value.replace(/[\\/]+$/g, "");
  if (trimmed.length === 0) {
    return value;
  }
  return /^[a-zA-Z]:$/.test(trimmed) ? `${trimmed}\\` : trimmed;
}

export function normalizeProjectPathForDispatch(value: string): string {
  return trimTrailingPathSeparators(value.trim());
}

export function normalizeProjectPathForComparison(value: string): string {
  const normalized = normalizeProjectPathForDispatch(value);
  if (isWindowsDrivePath(normalized) || isUncPath(normalized)) {
    return normalized.replaceAll("/", "\\").toLowerCase();
  }
  return normalized;
}

type AbsolutePathKind = "unix" | "windows-drive" | "unc";

interface SplitAbsolutePath {
  readonly kind: AbsolutePathKind;
  /** Case-folded root used to decide whether two paths share a volume. */
  readonly volume: string;
  readonly segments: readonly string[];
}

function splitAbsolutePath(value: string): SplitAbsolutePath | null {
  if (isUncPath(value)) {
    const segments = value
      .slice(2)
      .split(/[\\/]+/)
      .filter(Boolean);
    // `\\server\share` is the volume; anything shallower has no share to
    // compare, so a relative path between two such paths is meaningless.
    if (segments.length < 2) return null;
    return {
      kind: "unc",
      volume: `\\\\${segments[0]}\\${segments[1]}`.toLowerCase(),
      segments: segments.slice(2),
    };
  }
  if (isWindowsDrivePath(value)) {
    return {
      kind: "windows-drive",
      volume: value.slice(0, 2).toLowerCase(),
      segments: value
        .slice(2)
        .split(/[\\/]+/)
        .filter(Boolean),
    };
  }
  if (value.startsWith("/")) {
    return { kind: "unix", volume: "/", segments: value.split("/").filter(Boolean) };
  }
  return null;
}

/**
 * How many path segments an absolute path holds below its volume root.
 *
 * `/` is 0, `/Users` is 1, `/Users/me` is 2. Returns `null` for a path that is
 * not absolute. Callers use this to recognize a directory whose subtree is
 * likely to be enormous.
 */
export function workspacePathDepth(value: string): number | null {
  return splitAbsolutePath(normalizeProjectPathForDispatch(value))?.segments.length ?? null;
}

/**
 * Join an absolute root with a path relative to it, preserving the root's
 * separator style. The relative path is assumed to use POSIX separators, which
 * is what the workspace entry listing returns.
 */
export function joinWorkspacePath(root: string, relativePath: string): string {
  const base = normalizeProjectPathForDispatch(root);
  if (relativePath.length === 0) return base;
  const separator = isWindowsAbsolutePath(base) ? "\\" : "/";
  const suffix = relativePath.split("/").filter(Boolean).join(separator);
  return base.endsWith(separator) ? `${base}${suffix}` : `${base}${separator}${suffix}`;
}

/**
 * Express `target` relative to `from`, using POSIX separators so the result can
 * be embedded in a composer mention.
 *
 * Returns `null` when no relative path exists: the two paths sit on different
 * Windows drives or UNC shares, or either one is not absolute. Callers fall
 * back to the absolute path in that case.
 */
export function relativeWorkspacePath(from: string, target: string): string | null {
  const fromPath = splitAbsolutePath(normalizeProjectPathForDispatch(from));
  const targetPath = splitAbsolutePath(normalizeProjectPathForDispatch(target));
  if (!fromPath || !targetPath) return null;
  if (fromPath.kind !== targetPath.kind || fromPath.volume !== targetPath.volume) return null;

  // Windows compares path segments case-insensitively; POSIX does not.
  const caseSensitive = fromPath.kind === "unix";
  const fold = (segment: string) => (caseSensitive ? segment : segment.toLowerCase());
  let shared = 0;
  while (
    shared < fromPath.segments.length &&
    shared < targetPath.segments.length &&
    fold(fromPath.segments[shared]!) === fold(targetPath.segments[shared]!)
  ) {
    shared += 1;
  }

  const up = Array.from({ length: fromPath.segments.length - shared }, () => "..");
  const down = targetPath.segments.slice(shared);
  const relative = [...up, ...down].join("/");
  return relative.length === 0 ? "." : relative;
}
