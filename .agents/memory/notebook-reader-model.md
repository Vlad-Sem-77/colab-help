---
name: Notebook reader model availability
description: Why the notebook assistant currently uses local, notebook-grounded answers instead of a hosted model.
---

The notebook reader should not claim to be AI-powered unless a model provider is actually configured. In this workspace, the OpenAI AI-integration setup callback was unavailable and integration search returned no provider, so the reader was implemented as a transparent local analysis and source-matching assistant.

**Why:** The feature must work without asking users for credentials or silently shipping an assistant that cannot answer.

**How to apply:** Before adding a hosted model, re-check whether Replit AI Integrations or another approved provider is available. Keep notebook source excerpts visible in answers so users can verify what they rely on.
