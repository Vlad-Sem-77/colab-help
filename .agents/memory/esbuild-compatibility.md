---
name: Workspace esbuild compatibility
description: Separate esbuild version requirements for Vite and the API logger bundler.
---

Do not force one esbuild version across the workspace without checking each consumer. Vite 7.3 requires esbuild `^0.27.0 || ^0.28.0`, while `esbuild-plugin-pino` currently declares a peer range ending at `0.25.8`; keep the API build's compatible version separate from Vite's.

**Why:** A global pin to satisfy the API plugin can break Vite, while newer Vite-compatible esbuild versions may trigger a low-severity Windows-only advisory for esbuild's own `--servedir` development server.

**How to apply:** When changing build-tool versions, inspect both peer/dependency ranges and the vulnerable code path in the actual host environment before changing the workspace-wide override. Vite's own server and the API bundle build are separate use cases.
