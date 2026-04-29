# Agent Change Workflow

1. Run `git status --short` before editing.
2. If user changes exist in files you need to touch, stop and ask.
3. Push back when a request would leak secrets, make the architecture brittle, or add tooling before it earns its keep.
4. Prefer small changes with tests or a clear manual verification path.
5. After a coherent change, run the relevant verification command.
6. Commit the verified change without asking first.
7. In the final response, mention the commit and include the exact commit message.
8. Stop any dev/API/web servers or watchers you started before replying, unless the user explicitly asked you to keep them running.
9. Do not stop user-owned servers. Only clean up processes you launched.
10. Keep `AGENTS.md` concise. Put longer repeatable workflows in this folder.
