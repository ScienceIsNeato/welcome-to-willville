<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Deploying the app

**Always use the deploy script.** Never run `next dev`, `wrangler pages dev`, or any bespoke server commands directly.

```bash
scripts/deploy_app.sh          # build + start (auto-allocates a port)
scripts/deploy_app.sh --stop   # tear down this worktree's deployment
scripts/deploy_app.sh --status # show all running deployments
```

The script handles everything:

- Kills stale deployments older than 1 hour (across all agents/worktrees)
- Stops any existing deployment from the current worktree before starting a new one
- Copies `.dev.vars` (API secrets) into the worktree automatically
- Builds the static export
- Starts wrangler on a unique port (no collisions between worktrees)
- Prints the URL to browse

Do NOT:

- Run `next dev` or `wrangler pages dev` manually
- Hardcode ports (3736, 3737, etc.)
- Kill processes on ports you didn't start
- Modify `next.config.ts` to add dev-mode rewrites or proxy hacks
