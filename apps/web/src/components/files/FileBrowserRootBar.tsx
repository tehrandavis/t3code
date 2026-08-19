import type { EnvironmentId } from "@t3tools/contracts";
import { ChevronUp, CornerUpLeft, Folder } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { StartTruncatedPath } from "~/components/StartTruncatedPath";
import { Button } from "~/components/ui/button";
import { InputGroup, InputGroupInput } from "~/components/ui/input-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { ensureBrowseDirectoryPath } from "~/lib/projectPaths";
import { cn } from "~/lib/utils";

import { browseRootParent, isProjectBrowseRoot, normalizeBrowseRoot } from "./fileBrowserRoot";
import { useFilesystemBrowseQuery } from "./projectFilesQueryState";

interface FileBrowserRootBarProps {
  environmentId: EnvironmentId;
  /** The project's workspace root. The bar offers a way back to it. */
  projectCwd: string;
  /** The directory the tree is showing. */
  browseRoot: string;
  projectName: string;
  onNavigate: (root: string) => void;
}

/** Suggestions are a convenience, not a directory listing; a long list buries the input. */
const MAX_PATH_SUGGESTIONS = 8;

function PathSuggestions(props: {
  environmentId: EnvironmentId;
  projectCwd: string;
  query: string;
  onPick: (fullPath: string) => void;
}) {
  const suggestions = useFilesystemBrowseQuery(props.environmentId, props.projectCwd, props.query);
  const entries = suggestions.data?.entries ?? [];
  if (entries.length === 0) return null;
  return (
    <ul className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md">
      {entries.slice(0, MAX_PATH_SUGGESTIONS).map((entry) => (
        <li key={entry.fullPath}>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1 text-left text-xs hover:bg-accent"
            // The input keeps focus while suggestions are open, so commit on
            // mousedown: a click would first blur the input and close the list.
            onMouseDown={(event) => {
              event.preventDefault();
              props.onPick(entry.fullPath);
            }}
          >
            <Folder className="size-3 shrink-0 opacity-60" />
            <span className="truncate">{entry.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function FileBrowserRootBar({
  environmentId,
  projectCwd,
  browseRoot,
  projectName,
  onNavigate,
}: FileBrowserRootBarProps) {
  const [draftPath, setDraftPath] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isProjectRoot = isProjectBrowseRoot(projectCwd, browseRoot);
  const parentRoot = browseRootParent(browseRoot);

  useEffect(() => {
    if (draftPath === null) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [draftPath]);

  const commitDraft = (value: string) => {
    const nextRoot = normalizeBrowseRoot(value);
    setDraftPath(null);
    if (nextRoot.length === 0 || nextRoot === normalizeBrowseRoot(browseRoot)) return;
    onNavigate(nextRoot);
  };

  return (
    <div
      className="flex h-7 min-h-7 shrink-0 items-center gap-1 border-b border-border/60 bg-background px-2 in-data-[preview-panel-mode=inline]:mb-3 in-data-[preview-panel-mode=inline]:border-b-transparent"
      data-file-browser-root-bar
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Browse parent folder"
              disabled={parentRoot === null}
              onClick={() => {
                if (parentRoot !== null) onNavigate(parentRoot);
              }}
            />
          }
        >
          <ChevronUp />
        </TooltipTrigger>
        <TooltipPopup>Parent folder</TooltipPopup>
      </Tooltip>

      {draftPath === null ? (
        <button
          type="button"
          aria-label="Change the folder shown in the file tree"
          className={cn(
            "min-w-0 flex-1 rounded-sm px-1 py-0.5 text-left text-xs hover:bg-accent",
            isProjectRoot ? "text-muted-foreground" : "font-mono",
          )}
          onClick={() => setDraftPath(ensureBrowseDirectoryPath(browseRoot))}
        >
          {isProjectRoot ? (
            <span className="truncate">{projectName}</span>
          ) : (
            <StartTruncatedPath path={browseRoot} />
          )}
        </button>
      ) : (
        <div className="relative min-w-0 flex-1">
          <InputGroup variant="ghost" className="h-6 min-w-0">
            <InputGroupInput
              ref={inputRef}
              type="text"
              name="file-browser-root"
              size="sm"
              value={draftPath}
              aria-label="Folder path"
              placeholder="Go to folder"
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => setDraftPath(event.target.value)}
              onBlur={() => setDraftPath(null)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitDraft(event.currentTarget.value);
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setDraftPath(null);
                }
              }}
            />
          </InputGroup>
          <PathSuggestions
            environmentId={environmentId}
            projectCwd={projectCwd}
            query={draftPath}
            onPick={(fullPath) => setDraftPath(ensureBrowseDirectoryPath(fullPath))}
          />
        </div>
      )}

      {isProjectRoot ? null : (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Back to ${projectName}`}
                onClick={() => onNavigate(projectCwd)}
              />
            }
          >
            <CornerUpLeft />
          </TooltipTrigger>
          <TooltipPopup>Back to {projectName}</TooltipPopup>
        </Tooltip>
      )}
    </div>
  );
}
