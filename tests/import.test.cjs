const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const context = vm.createContext({ URL, AbortController, articleCache: new Map(), htmlCache: new Map(), window: { setTimeout, clearTimeout } });
vm.runInContext(source.slice(source.indexOf("function normalizeText("), source.lastIndexOf("updateSourcePreview();")), context);

test("homepage reader links retain the issue date and ignore images/external links", () => {
  const paper = context.parseReaderPaperIndex(`Markdown Content:
當前報紙日期：2026 年 9 月 8 日 星期 二
[新聞](https://www.macaodaily.com/content_123.htm)
[新聞](https://www.macaodaily.com/content_123.htm)
![圖片](https://www.macaodaily.com/content_456.htm)
[外站](https://example.com/content_123.htm)
[第A01版：澳聞](https://www.macaodaily.com/node_2.htm)
[第A02版：澳聞](https://www.macaodaily.com/node_3.htm)`, "https://www.macaodaily.com/");
  assert.equal(paper.currentUrl, "https://www.macaodaily.com/html/2026-09/08/node_2.htm");
  assert.equal(paper.articles.length, 1);
  assert.equal(paper.articles[0].url, "https://www.macaodaily.com/html/2026-09/08/content_123.htm");
  assert.equal(paper.pages.length, 2);
});

test("an empty advertising page can still navigate and keeps its selected page", () => {
  const url = "https://www.macaodaily.com/html/2026-06/29/node_3.htm";
  const paper = context.parseReaderPaperIndex(`Markdown Content:
[第A01版：澳聞](https://www.macaodaily.com/html/2026-06/29/node_2.htm)
[第A02版：廣告](${url})`, url);
  assert.equal(paper.currentUrl, url);
  assert.equal(paper.title, "第A02版：廣告");
  assert.equal(paper.articles.length, 0);
  assert.throws(() => context.parseReaderPaperIndex("Markdown Content: service unavailable", url));
});

test("failed sources preserve HTTP errors and do not prevent a successful fallback", async () => {
  context.fetch = async (url) => ({ ok: url.endsWith("/ok"), status: 403, text: async () => "valid" });
  assert.equal(await context.fetchFirstValid(["https://example.com/fail", "https://example.com/ok"], (text) => text), "valid");
  await assert.rejects(context.fetchFirstValid(["https://example.com/fail"], (text) => text), /HTTP 403/);
});

test("a winning source cancels pending network requests", async () => {
  let aborted = false;
  context.fetch = async (url, { signal }) => {
    if (url.endsWith("/ok")) return { ok: true, text: async () => "valid" };
    return new Promise((resolve, reject) => signal.addEventListener("abort", () => {
      aborted = true;
      reject(new Error("cancelled"));
    }, { once: true }));
  };
  assert.equal(await context.fetchFirstValid(["https://example.com/slow", "https://example.com/ok"], (text) => text), "valid");
  assert.equal(aborted, true);
});

function resetStorage() {
  const storage = {};
  Object.defineProperties(storage, {
    getItem: { value: (key) => storage[key] ?? null },
    setItem: { value: (key, value) => { storage[key] = value; } },
    removeItem: { value: (key) => { delete storage[key]; } },
  });
  context.window.sessionStorage = storage;
  context.htmlCache.clear();
  context.articleCache.clear();
}

test("paper cache survives a memory reset and aliases the homepage to its dated page", async () => {
  resetStorage();
  let requests = 0;
  context.fetch = async () => {
    requests++;
    return { ok: true, text: async () => `Markdown Content:
當前報紙日期：2026 年 9 月 19 日
[第A01版：澳聞](https://www.macaodaily.com/html/2026-09/19/node_2.htm)` };
  };
  const first = await context.fetchHtmlFromUrl("https://www.macaodaily.com/");
  const initialRequests = requests;
  context.htmlCache.clear();
  const second = await context.fetchHtmlFromUrl(first.paperData.currentUrl);
  await context.fetchHtmlFromUrl("https://www.macaodaily.com/");
  assert.equal(second.paperData.currentUrl, first.paperData.currentUrl);
  assert.equal(requests, initialRequests);
});

test("expired cache is ignored and disabled storage does not break imports", () => {
  resetStorage();
  context.writeImportCache("expired", "old", -1);
  assert.equal(context.readImportCache("expired"), null);
  context.window.sessionStorage = undefined;
  assert.doesNotThrow(() => context.writeImportCache("disabled", "value", 1000));
  assert.equal(context.readImportCache("disabled"), null);
});

test("a slow parser cannot block a faster fully parsed result", async () => {
  context.fetch = async () => ({ ok: true, text: async () => "valid" });
  let completeSlow;
  const slow = new Promise((resolve) => { completeSlow = resolve; });
  const result = await context.fetchFirstValid([
    { sourceUrl: "https://example.com/redirect", slow: true },
    { sourceUrl: "https://example.com/ready", slow: false },
  ], (payload) => payload.slow ? slow : "ready");
  assert.equal(result, "ready");
  completeSlow("late");
});
