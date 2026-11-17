import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedColabUrl } from "./colab-url.ts";

test("allows HTTPS URLs on supported Colab tunnel hosts", () => {
  assert.equal(isAllowedColabUrl("https://project.trycloudflare.com"), true);
  assert.equal(isAllowedColabUrl("https://project.ngrok-free.app/"), true);
  assert.equal(isAllowedColabUrl("https://project.ngrok.app"), true);
  assert.equal(isAllowedColabUrl("https://project.ngrok.io"), true);
});

test("rejects URLs that could redirect requests outside supported tunnels", () => {
  for (const url of [
    "http://project.trycloudflare.com",
    "https://127.0.0.1",
    "https://localhost",
    "https://trycloudflare.com.attacker.example",
    "https://attacker.example/anything",
    "https://user:pass@project.trycloudflare.com",
    "https://project.trycloudflare.com:8443",
    "https://project.trycloudflare.com/path",
    "https://project.trycloudflare.com/?next=anything",
    "https://project.trycloudflare.com/#fragment",
  ]) {
    assert.equal(isAllowedColabUrl(url), false, url);
  }
});
