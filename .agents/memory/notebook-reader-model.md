---
name: Notebook reader and AI provider boundaries
description: Product boundaries for local notebook reading, simulated execution, and opt-in hosted AI.
---

The main Notebook UI reads `.ipynb` files locally. Cell runs are simulations only: they do not execute Python or call Colab. The online AI teacher is separate and connects directly to the user's selected provider (AI Tunnel, ProxyAPI, RouterAI, or OpenAI); Google or Colab login is not needed for reading, simulation, or AI.

Provider chat model IDs must come from each provider's catalog. Users manually choose models for careful review or economical coding/help; do not rank models or imply objective quality scores. A personal provider key is entered in the app and held only in the server's volatile, per-browser session for up to 12 hours. It is never stored in browser storage, project secrets, a database, or logs, and is lost on server restart. Voice transcription and speech use separate provider-configured models; audio is sent only when the user records or requests speech. Embeddings are out of scope.

**Why:** The user wants an honest offline-capable reader and simulation now, with online AI as an optional service. They chose live provider catalogs, session-only key entry, and voice questions plus spoken answers; no Google account is connected to Replit.

**How to apply:** Keep file reading, local search, and simulation usable without provider keys. Keep credentials in server session memory, use an HttpOnly session cookie, and never place keys in URLs, browser storage, database records, or logs. Keep notebook and audio uploads opt-in; audio must remain transient and must not be persisted. Keep AI separate from cell execution. If describing the separate Colab bridge artifact, do not present its tunnel URL as Google-account authorization.

AI-generated cell explanations are opt-in annotations, requested per cell by default with only that cell and relevant context. Keep whole-notebook batch explanation as a secondary action. Require a connected provider/model and online-analysis consent; never modify the source `.ipynb` or exported cells.

**Why:** The user chose on-demand per-cell requests to avoid unnecessary model calls, while keeping notebook-wide explanations available on request.

**How to apply:** Generate an explanation only after a cell-level action under consent, send the selected cell plus relevant section/import/use context, and offer whole-notebook requests separately. Render annotations alongside source and keep them out of notebook export unless the user explicitly asks for export.

## Product direction

Keep offline notebook reading and simulated cell runs available as a learning mode when there is no network. When online, the intended experience also offers the AI teacher and actual execution through Google Colab. The current app still simulates runs and does not yet execute cells in Colab. Installing a local AI model is out of scope.

**Why:** The user clarified that simulation is useful for learning offline, while AI explanations and real Colab execution require internet.

**How to apply:** Preserve offline reading and simulation independently from online services. Clearly distinguish simulation from real Colab execution, and show AI/Colab as unavailable without internet rather than silently simulating them.
