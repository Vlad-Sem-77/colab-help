---
name: Notebook reader model availability
description: Why the notebook assistant currently uses local, notebook-grounded answers instead of a hosted model.
---

The notebook reader should not claim to be AI-powered unless a model provider is actually configured. The Replit OpenAI AI-integration setup callback is unavailable in this workspace and integration search returned no provider. The project does already have a server-side path to the user's connected Colab/OpenRouter model; notebook content is sent there only after explicit opt-in, with local source matching as the default and failure fallback.

**Why:** The feature must work without asking users for credentials or silently sending notebook content to a third party. Reusing the configured Colab route avoids exposing model credentials in the browser.

**How to apply:** Re-check provider availability before adding a new hosted model. If using the Colab route, disclose that notebook cells and text outputs pass through Colab to OpenRouter, require opt-in, request one-based cell citations, and preserve local search as fallback.

## Product direction

The user wants the AI teacher to remain online; installing a local AI model is too expensive and complicated. The current phase should provide an honest simulation of notebook execution; actual Python execution on the user's device comes later.

**Why:** The user explicitly chose this phased direction and ruled out local model installation.

**How to apply:** Keep explanation and execution as separate capabilities. Label simulated runs so they cannot be mistaken for real execution, and do not require a local AI model.
