# Browsing files

The Files panel opens beside a thread and shows the project's files. It starts at the project
folder, and you can move it anywhere else on the machine running the T3 Code server.

## Moving out of the project

Use the arrow above the tree to go to the parent folder. The row beside it shows where you are:
the project's name while the tree is showing the project, and the full path once you have left it.

Select that row to type a path. Suggestions appear as you type, and **Enter** goes there.

To return, choose the back arrow at the end of the row. It appears only while the tree is showing
something other than the project.

## What changes outside the project

Files outside the project open read-only. Everything else about the panel works the same: search,
preview, rendered markdown, and adding a file to the chat.

Adding an outside file to the chat still gives the agent a path it can follow. The mention reads
as a path from the project folder, such as `../notes/todo.md`, because that is where the agent is
running. Your agent may still refuse to read or write outside its working folder; that is the
agent's own rule, not T3 Code's.

The rest of the app stays with the project. Quick file search, content search, `@` mentions in the
composer, and the changed-files list all keep showing project files, whatever the tree is showing.

## Large folders

The tree lists a folder and everything below it. Inside a repository that is quick, because files
your `.gitignore` excludes are skipped.

Above a repository there is no `.gitignore` to prune with, so the listing can be slow. T3 Code asks
before listing a folder as broad as your home directory. When a folder holds more files than the
panel can list, a note appears under the header, and search covers only the files shown.

Where you were last browsing is remembered for each project.
