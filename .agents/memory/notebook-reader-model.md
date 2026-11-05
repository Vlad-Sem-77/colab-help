---
name: Notebook reader and AI provider boundaries
description: Product boundaries for local notebook reading, simulated execution, and opt-in hosted AI.
---

The main Notebook UI reads `.ipynb` files locally. Cell simulation remains client-side and does not execute Python. Real execution is a separate, explicit action through an execution-only helper notebook launched in the user's Google Colab session; it requires a temporary HTTPS tunnel URL and one-time bridge token. The online AI teacher remains separate and connects directly to the user's selected provider. Centralized execution/session history is not part of the core learning flow; the older Bridge's experiment log is legacy functionality.

Provider chat model IDs must come from each provider's catalog. Users manually choose models for careful review or economical coding/help; do not rank models or imply objective quality scores. A personal provider key is entered in the app and held only in the server's volatile, per-browser session for up to 12 hours. It is never stored in browser storage, project secrets, a database, or logs, and is lost on server restart. Voice transcription and speech use separate provider-configured models; audio is sent only when the user records or requests speech. Embeddings are out of scope.

**Why:** The user wants an honest offline-capable reader and simulation now, with online AI as an optional service. They chose live provider catalogs, session-only key entry, and voice questions plus spoken answers; no Google account is connected to Replit.

**How to apply:** Keep file reading and simulation client-side; when the app is already open, they must continue without internet. Disable online AI and Colab actions when offline. Keep the Colab token transient in page state and never persist or log it. Require a separate explicit execution confirmation before sending cell code to the user's Colab session. Keep provider credentials in server session memory, use an HttpOnly session cookie, and never place provider keys in URLs, browser storage, database records, or logs. Keep notebook and audio uploads opt-in; audio must remain transient and must not be persisted. A tunnel URL is not Google-account authorization.

AI-generated cell explanations are opt-in annotations, requested per cell by default with only that cell and relevant context. Keep whole-notebook batch explanation as a secondary action. Require a connected provider/model and online-analysis consent; never modify the source `.ipynb` or exported cells.

**Why:** The user chose on-demand per-cell requests to avoid unnecessary model calls, while keeping notebook-wide explanations available on request.

**How to apply:** Generate an explanation only after a cell-level action under consent, send the selected cell plus relevant section/import/use context, and offer whole-notebook requests separately. Render annotations alongside source and keep them out of notebook export unless the user explicitly asks for export.

## Product direction

The product's purpose is to read and understand `.ipynb` notebooks, run cells in the user's Google Colab session, and learn with an online AI teacher. Offline simulation remains available as a learning aid. Centralized history of runs or sessions is not a product requirement unless explicitly requested.

**Why:** The user clarified that the learning flow is notebook reading, Colab cell execution, and AI explanations; old experiment history is not useful to that core flow.

**How to apply:** Preserve offline reading and simulation independently from online services. Clearly distinguish simulation from real Colab execution, and show AI/Colab as unavailable without internet rather than silently simulating them. Do not add or retain centralized execution/session history as a core feature without a separate user request.
