# Untether the Files panel from the project root

Date: 2026-08-18
Status: implemented on `feat/untethered-file-browser`

## Problem

The Files panel in the right sidebar can only show files under the active
project's workspace root. A user who wants to look at a sibling repo, a notes
folder, or anything else on the machine has no way to do it from T3 Code.

## Goal

Let the panel's root move to any folder on the host, while the project keeps
owning everything an agent sees.

## Decisions

| Question | Decision |
|-|-|
| Navigation model | One root that moves. Navigate up and out; no multi-root tree. |
| Listing above the project | Reuse the existing recursive index. |
| Write access outside the project | Read only. |
| Mention paths | Always relative to the project root. |
| Surfaces | Web and desktop. Mobile is out. |
| Persistence | Per project, persisted across reloads. |

## Model

The panel today derives everything from one value, `activeWorkspaceRoot`,
passed from `apps/web/src/components/ChatView.tsx`. That splits into two.

- `projectCwd` stays the project root. It governs writes, mentions, and
  everything outside the panel.
- `browseRoot` is what the tree lists. It defaults to `projectCwd`.

`browseRoot` itself splits into two pieces of client state:

- `pendingRoot` drives the breadcrumb and updates on click, so navigation feels
  instant.
- `committedRoot` drives the query and lags `pendingRoot` by about 300 ms of
  quiet.

The debounce exists because pass-through navigation is the real cost. Three
fast clicks on "up" from `~/dev/t3code` would otherwise fire three
`listEntries` calls, and the third scans all of `/Users/<user>`. Two of those
scans are for folders the user never intended to open.

### What follows `browseRoot`

The file tree, its search field, the refresh button, and the preview pane.

### What stays pinned to `projectCwd`

The command palette file picker, content search, `@` mention autocomplete, the
changed-files tree, diffs, checkpoints, and every write.

Agents run in the project. Their view of the workspace must not shift because
someone browsed a neighbor folder.

## Server

No change is required for listing or reading.

`projects.listEntries` and `projects.readFile` in `apps/server/src/ws.ts`
already accept an arbitrary `cwd`. Nothing checks that the `cwd` belongs to a
registered project. `normalizeWorkspaceRoot` runs without `createIfMissing`,
so a bad path fails instead of creating a folder.

A paired client can already read any directory on the host through these RPCs.
This feature surfaces that in the UI. It does not widen the server.

One server test is added to pin the behavior the feature now depends on:
`projects.listEntries` succeeds for a `cwd` that is not a registered project.

## Panel UI

The header in `apps/web/src/components/files/FileBrowserPanel.tsx` holds a
refresh button and a search field. Three things join them.

**Root line.** A breadcrumb showing the current root. Inside the project it
renders the project name. `StartTruncatedPath` handles long paths and keeps the
tail readable. There is no `~` shortening: the client never learns the host's
home directory, and inventing one would be wrong for remote environments.

**Up control.** One button that sets `pendingRoot` to its parent. It disables
at the filesystem root. Parent computation goes in a shared helper with its own
tests. Windows and WSL forms have existing helpers in
`apps/web/src/wslPaths.ts` and `@t3tools/shared/path`; a naive `split("/")`
is wrong.

**Path entry and return.** Clicking the breadcrumb opens a path input with
directory suggestions from the `filesystem.browse` RPC, the same one the command
palette uses when adding a project. The server returns directories already
filtered by prefix, so the panel renders them directly. When `browseRoot`
differs from `projectCwd`, a "back to project" control appears. A one-way door
is a bug.

**Huge-root guard.** A root two or fewer segments below its volume root covers
`/`, `/Users`, and a home directory such as `/Users/me` without the client
needing to know where home is. Navigating to one confirms first. The confirm
runs on the click, not after the debounce, so it never stacks behind a pending
commit.

**Truncation banner.** `ProjectListEntriesResult` already carries `truncated`,
and the UI ignores it today. Above a repo, hitting the 25,000-entry cap becomes
likely rather than theoretical. The banner states the limit and notes that
search covers only what was listed. Scan timeouts read the same way, as a
stated limit rather than a hang.

## Read-only outside the project

`FilePreviewPanel` now takes three roots, each with one job. `projectCwd`
governs writes. `browseRoot` is what the tree lists. `fileRoot` is the directory
the previewed file's `relativePath` is measured from, which is the project for
anything opened from search, a diff, or a chat link. When `fileRoot` is not
`projectCwd`, the file renders through the read-only surface that truncated
files already use, so the editor never arms.

This is explicit, not incidental. Leaning on the server's containment guard to
reject the write would surface as a failed save after the user typed. The guard
in `apps/server/src/workspace/WorkspaceFileSystem.ts` stays exactly as it is,
as a second line.

Every write path takes the same gate: the save coordinator, the review-comment
path, and the optimistic file cache in `projectFilesQueryState.ts`. That cache
keys on `(environmentId, cwd, relativePath)`, so a moved root already keys
separately.

## Mentions

A mention is a markdown link, `[label](destination)`, and
`serializeComposerFileLink` in `packages/shared/src/composerTrigger.ts` already
sets the label to the basename alone. The chip the user sees does not change.
Only the destination changes, and the destination is what reaches the agent.

The rule is one line: every mention destination is
`path.relative(projectCwd, absolutePath)`.

Inside the project this produces exactly today's string. Outside it produces
`../../notes/file.md`, which the agent resolves against its own cwd.

One fallback is necessary. A relative path cannot be expressed across Windows
drive letters or to a UNC path. There the destination falls back to absolute.
That is a single named exception with a test.

The same rule applies to the drag payload in
`apps/web/src/components/files/fileTreeDragMention.ts`, so drag and context
menu never disagree.

The chip carries a `title` attribute with the full destination. Without it an
out-of-project mention looks identical to a local one.

Note: a `../` path may still be refused by an agent's own sandbox. Codex and
Claude Code both restrict writes outside the working directory by policy. The
mention is a request; the agent's rules still apply. Absolute paths hit the
same wall, so this is not a reason to prefer one form over the other.

## Open file surfaces

`RightPanelSurface` identifies an open file by `relativePath` alone
(`apps/web/src/rightPanelStore.ts`). That becomes ambiguous once the root
moves. The surface gains a `root` field defaulting to `projectCwd`, and the
surface id becomes root-qualified. An open file then keeps its meaning when the
root moves under it.

## Persistence

`browseRoot` persists per project in the existing `uiStateStore`, next to
`setProjectExpanded`. On load, a stored root that no longer exists falls back to
`projectCwd` silently.

## Where the code landed

- `packages/shared/src/path.ts` — `relativeWorkspacePath`, `joinWorkspacePath`,
  and `workspacePathDepth`, with tests.
- `apps/web/src/components/files/fileBrowserRoot.ts` — parent, shallow-root, and
  mention-destination rules, with tests.
- `apps/web/src/components/files/FileBrowserRootBar.tsx` — the root row.
- `apps/web/src/components/files/FileBrowserPanel.tsx` — pending/committed root,
  the debounce, the confirm, the truncation banner.
- `apps/web/src/components/files/FilePreviewPanel.tsx` — the three roots and the
  read-only surface.
- `apps/web/src/uiStateStore.ts` — `fileBrowserRootByProjectCwd`.
- `apps/web/src/rightPanelStore.ts` — the surface `root` field.
- `apps/web/src/components/ChatView.tsx` — wiring.
- `apps/server/src/server.test.ts` — the out-of-project listing test.
- `docs/user/file-browser.md`.

## Costs accepted

Each visited root creates its own native index in an `RcMap` with a 15-minute
idle TTL (`WorkspaceSearchIndex.ts`). Browsing creates only the `paths`
variant; the content index builds only on content search. That is roughly a
couple of megabytes per visited root, reclaimed after 15 minutes.

The debounce means a user leaves behind only roots they actually visited, not
every folder they passed through. This is documented in the PR rather than
engineered away.

If measurement later shows the TTL is not enough, add a
`projects.releaseEntriesIndex` RPC called when the panel leaves a non-project
root. `workspaceSearchIndexes.invalidate(indexKey)` already exists internally
for the refresh error path, so the server work is small. It does not earn its
place before there is a number.

Client-side caching is already bounded. The `listEntries` atom family sets
`idleTtlMs: 5 * 60_000` in
`packages/client-runtime/src/state/projectCommands.ts`.

Scanning above a repo also loses the gitignore pruning that made the scan
cheap. A folder holding many repos will scan `node_modules` trees. The 25,000
cap and the 15-second timeout hold the damage; the banner makes it visible.

## Not built

Multiple simultaneous roots. Lazy per-folder expansion. Editing outside the
project. Mobile. Each was considered and cut.

Lazy expansion deserves a note: `@pierre/trees` at 1.0.0-beta.4 exposes
`resetPaths` and a mutation handle with `add`/`batch`, but no expand event to
subscribe to. Lazy loading would need a store-subscription diff of expanded
paths. That is the fragile part, and the recursive index makes it unnecessary.

## Tests

All focused. No repo-wide checks.

- Parent-path and home-shortening helpers, including Windows and WSL forms.
- Mention destinations: relative inside the project, relative with `..`
  outside, absolute across Windows drives.
- Read-only gating when `browseRoot` differs from `projectCwd`.
- Debounce: rapid root changes issue one `listEntries` call.
- Persistence: a stored root that no longer exists falls back to `projectCwd`.
- Surface identity: an open file survives a root change.
- Server: `projects.listEntries` succeeds for a non-project `cwd`.

Run with `vp test run <files>`, plus targeted lint and typecheck.

## Surfaces walked

- Entry points: the Files panel header, and the right-panel file surface.
- Clients: web and desktop, since desktop wraps web. Mobile is out of scope.
- Providers: none. No provider adapter sees `browseRoot`.
- Contracts: no change. `packages/contracts` is untouched.
- Reverse states: "back to project" returns the root, and the up control
  disables at the filesystem root.
- Connection modes: unchanged. The RPCs already work over local, relay, and
  tunnel.
- Docs: a `docs/user/` note, since the behavior is user-visible.
