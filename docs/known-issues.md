# Known issues

## Slow static file loading in WSL2

**Symptoms:** CSS and other static files take 2-4 seconds to load when
running a local dev server in WSL2, despite small file sizes (~75KB).

**Cause:** WSL2 networking has known performance issues when serving files
to a Windows browser. The delay appears in "Waiting for server response"
(TTFB) and download time, not the server itself.

**Affected servers:** Both `python3 -m http.server` and `npx serve` exhibit
the same behaviour.

**Workarounds tried (no improvement):**
- Using `127.0.0.1` instead of `localhost`
- Switching between Python and Node servers
- Ensuring files are in native WSL filesystem (`/home/...` not `/mnt/c/...`)

**Impact:** Development only. Production deployments are unaffected.

**Status:** Accepted as WSL2 limitation. Does not affect functionality.
