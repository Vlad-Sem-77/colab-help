---
name: Notebook reader and AI provider boundaries
description: Product boundaries for local notebook reading, simulated execution, and opt-in hosted AI.
---

The main Notebook UI reads `.ipynb` files locally. Cell runs are simulations only: they do not execute Python or call Colab. The online AI teacher is separate and connects directly to the user's selected provider (AI Tunnel, ProxyAPI, RouterAI, or OpenAI); Google or Colab login is not needed for reading, simulation, or AI.

Provider model IDs must come from each provider's catalog. Users manually choose one model for careful review and another for economical coding/help; do not rank models or imply objective quality scores. The user enters a provider key inside the app for the current session; it must not be persisted in browser storage, project secrets, a database, or logs. Notebook text is sent to the chosen provider only after explicit user consent.

**Why:** The user wants an honest offline-capable reader and simulation now, with online AI as an optional service. They explicitly chose real provider catalogs, separate review/economy model selections, and session-only key entry; no Google account is connected to Replit.

**How to apply:** Keep file reading, local search, and simulation usable without provider keys. Hold a key only in session memory, pass it in a redacted request header when needed, and clear it on provider change or page reload. Never place it in URLs, persistent storage, generated query parameters, or logs. Keep AI requests opt-in and clearly separate from cell execution. If describing the separate Colab bridge artifact, do not present its tunnel URL as Google-account authorization.

## Product direction

The user wants the AI teacher to remain online; installing a local AI model is too expensive and complicated. Actual Python execution on the user's device is a later phase.

**Why:** The user explicitly chose this phased direction and ruled out local model installation.

**How to apply:** Keep explanation and execution as separate capabilities. Label simulated runs so they cannot be mistaken for real execution, and do not require a local AI model.
