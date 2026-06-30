const defaultText =
  `澳門，包括澳門半島、氹仔島和路環島，自古以來就是中國的領土，十六世紀中葉以後被葡萄牙逐步佔領。一九八七年四月十三日，中葡兩國政府簽署了關於澳門問題的聯合聲明，確認中華人民共和國政府於一九九九年十二月二十日恢復對澳門行使主權，從而實現了長期以來中國人民收回澳門的共同願望。

為了維護國家的統一和領土完整，有利於澳門的社會穩定和經濟發展，考慮到澳門的歷史和現實情況，國家決定，在對澳門恢復行使主權時，根據中華人民共和國憲法第三十一條的規定，設立澳門特別行政區，並按照“一個國家，兩種制度”的方針，不在澳門實行社會主義的制度和政策。國家對澳門的基本方針政策，已由中國政府在中葡聯合聲明中予以闡明。

根據中華人民共和國憲法，全國人民代表大會特制定中華人民共和國澳門特別行政區基本法，規定澳門特別行政區實行的制度，以保障國家對澳門的基本方針政策的實施。`;

const state = {
  sourceText: normalizeText(defaultText),
  durationSeconds: 5 * 60,
  secondsLeft: 5 * 60,
  started: false,
  finished: false,
  timerId: null,
  composing: false,
};

const els = {
  timeLeft: document.querySelector("#timeLeft"),
  speed: document.querySelector("#speed"),
  accuracy: document.querySelector("#accuracy"),
  progress: document.querySelector("#progress"),
  speedBar: document.querySelector("#speedBar"),
  accuracyBar: document.querySelector("#accuracyBar"),
  progressBar: document.querySelector("#progressBar"),
  promptText: document.querySelector("#promptText"),
  typingInput: document.querySelector("#typingInput"),
  startBtn: document.querySelector("#startBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  statusText: document.querySelector("#statusText"),
  charCount: document.querySelector("#charCount"),
  sourcePreview: document.querySelector("#sourcePreview"),
  customText: document.querySelector("#customText"),
  customMinutes: document.querySelector("#customMinutes"),
  useCustomText: document.querySelector("#useCustomText"),
  fileInput: document.querySelector("#fileInput"),
  urlInput: document.querySelector("#urlInput"),
  fetchUrl: document.querySelector("#fetchUrl"),
  paperBrowser: document.querySelector("#paperBrowser"),
  paperFrame: document.querySelector("#paperFrame"),
  closePaper: document.querySelector("#closePaper"),
};

document.querySelectorAll(".time-option").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.started) return;
    document.querySelectorAll(".time-option").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    els.customMinutes.value = "";
    state.durationSeconds = Number(button.dataset.minutes) * 60;
    state.secondsLeft = state.durationSeconds;
    updateTime();
    updateMetrics();
  });
});

els.customMinutes.addEventListener("input", () => {
  if (state.started) return;

  const minutes = Number(els.customMinutes.value);
  if (!Number.isFinite(minutes) || minutes <= 0) return;

  document.querySelectorAll(".time-option").forEach((item) => item.classList.remove("is-active"));
  state.durationSeconds = Math.round(minutes) * 60;
  state.secondsLeft = state.durationSeconds;
  updateTime();
  updateMetrics();
});

els.customMinutes.addEventListener("blur", () => {
  if (state.started || !els.customMinutes.value) return;

  const minutes = Math.min(180, Math.max(1, Math.round(Number(els.customMinutes.value))));
  els.customMinutes.value = String(minutes);
  state.durationSeconds = minutes * 60;
  state.secondsLeft = state.durationSeconds;
  updateTime();
  updateMetrics();
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("is-active"));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("is-active"));
    tab.classList.add("is-active");
    document.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add("is-active");
  });
});

els.useCustomText.addEventListener("click", () => {
  setSourceText(els.customText.value, "已使用貼上的文章。");
});

els.fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  if (!file.name.toLowerCase().endsWith(".txt") && file.type !== "text/plain") {
    setStatus("請選擇 .txt 純文字檔。");
    return;
  }

  const text = await file.text();
  setSourceText(text, `已導入：${file.name}`);
});

els.fetchUrl.addEventListener("click", async () => {
  const url = els.urlInput.value.trim();
  if (!isValidHttpUrl(url)) {
    setStatus("請輸入有效的 http 或 https 網址。");
    return;
  }

  els.fetchUrl.disabled = true;
  setStatus(isMacauDailyIndexUrl(url) ? "正在載入電子日報..." : "正在提取網站文章...");

  try {
    if (isMacauDailyIndexUrl(url)) {
      await loadPaperBrowser(url);
      setStatus("已載入電子日報。點擊報道後會自動提取正文。");
    } else {
      await importArticleFromUrl(url);
    }
  } catch (error) {
    setStatus(`處理失敗：${error.message}`);
  } finally {
    els.fetchUrl.disabled = false;
  }
});

els.closePaper.addEventListener("click", () => {
  els.paperFrame.removeAttribute("srcdoc");
  els.paperBrowser.hidden = true;
});

window.addEventListener("message", async (event) => {
  if (event.data?.type !== "macau-daily-link") return;

  const articleUrl = resolveMacauDailyUrl(event.data.href);
  if (!articleUrl || !isMacauDailyArticleUrl(articleUrl)) {
    setStatus("請點擊電子日報中的報道連結。");
    return;
  }

  els.fetchUrl.disabled = true;
  setStatus("正在提取所選報道...");

  try {
    els.urlInput.value = articleUrl;
    await importArticleFromUrl(articleUrl);
  } catch (error) {
    setStatus(`提取失敗：${error.message}`);
  } finally {
    els.fetchUrl.disabled = false;
  }
});

els.startBtn.addEventListener("click", startPractice);
els.resetBtn.addEventListener("click", resetPractice);

els.typingInput.addEventListener("paste", blockTransfer);
els.typingInput.addEventListener("drop", blockTransfer);
els.typingInput.addEventListener("beforeinput", (event) => {
  if (event.inputType === "insertFromPaste" || event.inputType === "insertFromDrop") {
    blockTransfer(event);
  }
});
els.typingInput.addEventListener("compositionstart", () => {
  state.composing = true;
});
els.typingInput.addEventListener("compositionend", () => {
  state.composing = false;
  handleTyping();
});
els.typingInput.addEventListener("input", () => {
  if (!state.composing) handleTyping();
});

function startPractice() {
  if (!state.sourceText) {
    setStatus("請先導入一段文章。");
    return;
  }

  state.started = true;
  state.finished = false;
  els.typingInput.disabled = false;
  els.typingInput.focus();
  els.startBtn.disabled = true;
  document.querySelectorAll(".time-option").forEach((button) => {
    button.disabled = true;
  });
  els.customMinutes.disabled = true;
  setStatus("練習中：此輸入框不能貼上或拖放文字。");

  if (!state.timerId) {
    state.timerId = window.setInterval(() => {
      state.secondsLeft -= 1;
      updateTime();
      updateMetrics();
      if (state.secondsLeft <= 0) finishPractice("時間到，練習已完成。");
    }, 1000);
  }
}

function resetPractice() {
  window.clearInterval(state.timerId);
  state.timerId = null;
  state.started = false;
  state.finished = false;
  state.secondsLeft = state.durationSeconds;
  els.typingInput.value = "";
  els.typingInput.disabled = true;
  els.startBtn.disabled = false;
  document.querySelectorAll(".time-option").forEach((button) => {
    button.disabled = false;
  });
  els.customMinutes.disabled = false;
  setStatus("已重置，可以重新開始。");
  renderPrompt();
  updateTime();
  updateMetrics();
}

function finishPractice(message) {
  window.clearInterval(state.timerId);
  state.timerId = null;
  state.started = false;
  state.finished = true;
  els.typingInput.disabled = true;
  els.startBtn.disabled = false;
  document.querySelectorAll(".time-option").forEach((button) => {
    button.disabled = false;
  });
  els.customMinutes.disabled = false;
  setStatus(message);
  updateMetrics();
}

function handleTyping() {
  if (!state.started || state.finished) return;

  const alignment = buildTypingAlignment(state.sourceText, els.typingInput.value);
  if (alignment.isComplete) {
    els.typingInput.value = els.typingInput.value.slice(0, state.sourceText.length);
    renderPrompt();
    finishPractice("文章完成，練習已結束。");
    return;
  }

  renderPrompt();
  updateMetrics();
}

function blockTransfer(event) {
  event.preventDefault();
  setStatus("練習輸入框已禁止貼上和拖放文字。");
}

function setSourceText(text, message) {
  const normalized = normalizeText(text);
  if (normalized.length < 20) {
    setStatus("文章太短，請至少提供 20 個字。");
    return;
  }

  state.sourceText = normalized;
  resetPractice();
  setStatus(message);
  updateSourcePreview();
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchArticleFromUrl(url) {
  const urls = [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://r.jina.ai/${url}`,
  ];
  let lastError = "";

  for (const sourceUrl of urls) {
    const text = await tryFetch(sourceUrl);
    if (!text) continue;

    try {
      const article = extractArticleText(text);
      if (article.length >= 20) return article;
      lastError = "未能讀取足夠正文。";
    } catch (error) {
      lastError = error.message;
    }
  }

  throw new Error(lastError || "網站可能阻擋跨域讀取，請改用貼上文字導入。");
}

async function importArticleFromUrl(url) {
  const article = await fetchArticleFromUrl(url);
  setSourceText(article, "已從網站提取文章。");
}

async function loadPaperBrowser(url) {
  const html = await fetchHtmlFromUrl(url);
  const page = buildEmbeddablePaperPage(html, url);
  els.paperFrame.srcdoc = page;
  els.paperBrowser.hidden = false;
}

async function fetchHtmlFromUrl(url) {
  const urls = [
    url,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ];

  for (const sourceUrl of urls) {
    const text = await tryFetch(sourceUrl);
    if (text && text.trim().startsWith("<")) return text;
  }

  throw new Error("未能載入電子日報頁面。");
}

function buildEmbeddablePaperPage(html, pageUrl) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script").forEach((node) => node.remove());
  doc.querySelectorAll("[onclick], [onmouseover], [onmouseout], [onload]").forEach((node) => {
    node.removeAttribute("onclick");
    node.removeAttribute("onmouseover");
    node.removeAttribute("onmouseout");
    node.removeAttribute("onload");
  });

  const base = doc.createElement("base");
  base.href = pageUrl;
  doc.head.prepend(base);

  const style = doc.createElement("style");
  style.textContent = `
    html, body { margin: 0; background: #fff; }
    body { transform-origin: top left; }
    a, area { cursor: pointer; }
    img { max-width: none; }
  `;
  doc.head.appendChild(style);

  const bridge = doc.createElement("script");
  bridge.textContent = `
    document.addEventListener("click", function (event) {
      var link = event.target.closest && event.target.closest("a[href], area[href]");
      if (!link) return;
      event.preventDefault();
      parent.postMessage({ type: "macau-daily-link", href: link.href }, "*");
    }, true);
  `;
  doc.body.appendChild(bridge);

  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

async function tryFetch(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  }
}

function extractArticleText(raw) {
  if (!raw || raw.trim().length < 80) {
    throw new Error("未能讀取足夠內容。");
  }

  if (!raw.trim().startsWith("<")) {
    const text = cleanupReaderMarkdown(raw);
    if (text.length < 20) throw new Error("未能讀取足夠正文。");
    return text;
  }

  const doc = new DOMParser().parseFromString(raw, "text/html");
  doc.querySelectorAll("script, style, nav, header, footer, aside, form, iframe, noscript").forEach((node) => {
    node.remove();
  });

  const macauDailyText = extractMacauDailyText(doc);
  if (macauDailyText) return macauDailyText;

  const candidates = [
    "article",
    "founder-content",
    ".article",
    ".article-content",
    ".content",
    ".news-content",
    ".main-content",
    "#article",
    "#content",
    "main",
    "body",
  ];

  let bestText = "";
  for (const selector of candidates) {
    doc.querySelectorAll(selector).forEach((node) => {
      const text = cleanupExtractedText(node.textContent);
      if (scoreChineseText(text) > scoreChineseText(bestText)) bestText = text;
    });
  }

  if (bestText.length < 80) {
    throw new Error("未找到清晰正文，請改用貼上文字導入。");
  }

  return bestText;
}

function cleanupReaderMarkdown(text) {
  const content = String(text || "").includes("Markdown Content:")
    ? String(text).split("Markdown Content:").slice(1).join("Markdown Content:")
    : String(text || "");

  const lines = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(/\[!\[[^\]]*\]\([^)]+\)\]\([^)]+\)/g, "")
        .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/^#{1,6}\s*/, "")
    )
    .map(cleanupLine)
    .filter((line) => line && !line.includes("![Image") && !/^Title:|^URL Source:|^Published Time:/i.test(line));

  const bodyLines = hasMessageMarker(lines) ? trimToMessageBody(lines) : trimReaderWithoutMarker(lines);
  return cleanArticleLines(removeRepeatedNearbyLines(bodyLines)).join("\n");
}

function trimToMessageBody(lines) {
  const bodyStart = lines.findIndex((line) => /【[^】]{1,40}】/.test(line));
  if (bodyStart < 0) return lines;

  const bodyLines = lines.slice(bodyStart);
  bodyLines[0] = removeMessageMarker(bodyLines[0]);
  return bodyLines.filter(Boolean);
}

function removeMessageMarker(line) {
  return cleanupLine(String(line || "").replace(/^.*?【[^】]{1,40}】\s*/, ""));
}

function hasMessageMarker(lines) {
  return lines.some((line) => /【[^】]{1,40}】/.test(line));
}

function cleanArticleLines(lines) {
  return lines
    .map((line) =>
      cleanupLine(
        String(line || "")
          .replace(/\s*[0-9０-９]?\s*上一篇\s+下一篇\s*[0-9０-９]?\s*$/u, "")
          .replace(/\s*[0-9０-９]?\s*(上一篇|下一篇)\s*[0-9０-９]?\s*$/u, "")
      )
    )
    .filter((line) => line && !isNavigationLine(line));
}

function isNavigationLine(line) {
  return /^[0-9０-９\s]*(上一篇\s*下一篇|上一篇|下一篇)[0-9０-９\s]*$/u.test(line);
}

function removeLeadingTitle(lines, title) {
  const normalizedTitle = cleanupLine(title);
  if (!normalizedTitle) return lines;

  const result = [...lines];
  while (result.length && cleanupLine(result[0]) === normalizedTitle) {
    result.shift();
  }
  return result;
}

function trimReaderWithoutMarker(lines) {
  const cleaned = cleanArticleLines(lines).filter((line) => !isBoilerplateLine(line));
  const firstParagraphIndex = cleaned.findIndex((line) => isLikelyBodyParagraph(line));
  if (firstParagraphIndex >= 0) return cleaned.slice(firstParagraphIndex);

  const counts = new Map();
  for (const line of cleaned) {
    if (isLikelyArticleTitle(line)) counts.set(line, (counts.get(line) || 0) + 1);
  }

  let repeatedTitle = "";
  for (const [line, count] of counts) {
    if (count >= 2) repeatedTitle = line;
  }

  if (!repeatedTitle) return cleaned;

  const lastTitleIndex = cleaned.lastIndexOf(repeatedTitle);
  return cleaned.slice(lastTitleIndex + 1);
}

function isLikelyArticleTitle(line) {
  return line.length >= 4 && line.length <= 40 && scoreChineseText(line) >= 4 && !/[。！？]$/.test(line);
}

function isLikelyBodyParagraph(line) {
  return line.length >= 25 && scoreChineseText(line) >= 20 && /[。！？]$/.test(line);
}

function isBoilerplateLine(line) {
  return (
    /^第[A-Z0-9０-９]+版/.test(line) ||
    /本版標題導航|設為首頁|返回主頁|今日日期|當前報紙日期|版面導航|放大|縮小|默认|默認/.test(line)
  );
}

function removeRepeatedNearbyLines(lines) {
  const cleaned = [];
  for (const line of lines) {
    const recent = cleaned.slice(-3);
    if (!recent.includes(line)) cleaned.push(line);
  }
  return cleaned;
}

function extractMacauDailyText(doc) {
  const founderContent = doc.querySelector("founder-content");
  if (!founderContent) return "";

  const lines = Array.from(founderContent.querySelectorAll("p"))
    .map((node) => cleanupLine(node.textContent))
    .filter(Boolean);

  if (!lines.length) {
    const fallback = cleanupExtractedText(founderContent.textContent);
    return fallback.length >= 80 ? fallback : "";
  }

  const title = extractFounderTitle(doc);
  const hasMarker = hasMessageMarker(lines);
  const trimmedLines = trimToMessageBody(lines);
  const bodyLines = cleanArticleLines(hasMarker ? trimmedLines : removeLeadingTitle(trimmedLines, title));
  const text = bodyLines.join("\n");
  return text.length >= 80 ? text : "";
}

function extractFounderTitle(doc) {
  const property = Array.from(doc.childNodes)
    .filter((node) => node.nodeType === Node.COMMENT_NODE)
    .map((node) => node.textContent)
    .find((text) => text.includes("founder-title"));

  const titleFromComment = property?.match(/<founder-title>([\s\S]*?)<\/founder-title>/i)?.[1];
  if (titleFromComment) return cleanupLine(titleFromComment);

  const titleNode = Array.from(doc.querySelectorAll("strong"))
    .map((node) => cleanupLine(node.textContent))
    .find((text) => scoreChineseText(text) >= 4 && text.length <= 40);

  return titleNode || "";
}

function cleanupLine(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanupExtractedText(text) {
  return normalizeText(
    String(text || "")
      .replace(/\u00a0/g, " ")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !/^(分享|返回|上一頁|下一頁|廣告|Copyright)/i.test(line))
      .join("\n")
  );
}

function scoreChineseText(text) {
  const chineseCount = (text.match(/[\u3400-\u9fff]/g) || []).length;
  return chineseCount + Math.min(text.length, 3000) * 0.08;
}

function renderPrompt() {
  const typed = els.typingInput.value;
  const alignment = buildTypingAlignment(state.sourceText, typed);
  const fragment = document.createDocumentFragment();

  Array.from(state.sourceText).forEach((char, index) => {
    const span = document.createElement("span");
    span.className = "prompt-char";
    span.textContent = char;

    if (alignment.states[index]) {
      span.classList.add(alignment.states[index]);
    } else if (index === alignment.currentIndex && state.started) {
      span.classList.add("current");
    }

    fragment.appendChild(span);
  });

  els.promptText.replaceChildren(fragment);
}

function updateMetrics() {
  const typed = els.typingInput.value;
  const elapsedSeconds = Math.max(0, state.durationSeconds - state.secondsLeft);
  const elapsedMinutes = Math.max(elapsedSeconds / 60, 1 / 60);
  const alignment = buildTypingAlignment(state.sourceText, typed);
  const correct = alignment.correct;
  const checked = correct + alignment.wrong + alignment.missed + alignment.extra;
  const accuracy = checked ? Math.round((correct / checked) * 100) : 100;
  const speed = Math.round(correct / elapsedMinutes);
  const progress = state.sourceText.length
    ? Math.min(100, Math.round((alignment.currentIndex / state.sourceText.length) * 100))
    : 0;

  els.speed.textContent = String(speed);
  els.accuracy.textContent = String(accuracy);
  els.progress.textContent = String(progress);
  els.speedBar.style.width = `${Math.min(100, Math.round((speed / 120) * 100))}%`;
  els.accuracyBar.style.width = `${accuracy}%`;
  els.progressBar.style.width = `${progress}%`;
}

function buildTypingAlignment(sourceText, typedText) {
  const source = Array.from(sourceText);
  const typed = Array.from(typedText);
  const n = source.length;
  const m = typed.length;
  const states = Array(n).fill("");

  if (!m) {
    return { states, currentIndex: 0, correct: 0, wrong: 0, missed: 0, extra: 0, isComplete: false };
  }

  const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 0; i <= n; i += 1) dp[i][0] = i;
  for (let j = 0; j <= m; j += 1) dp[0][j] = j;

  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const substitutionCost = source[i - 1] === typed[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j - 1] + substitutionCost,
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1
      );
    }
  }

  let endIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= n; i += 1) {
    const cost = dp[i][m];
    const score = cost + (n - i) * 0.25;
    if (score < bestScore || (score === bestScore && i > endIndex)) {
      bestScore = score;
      endIndex = i;
    }
  }

  let i = endIndex;
  let j = m;
  let correct = 0;
  let wrong = 0;
  let missed = 0;
  let extra = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const substitutionCost = source[i - 1] === typed[j - 1] ? 0 : 1;
      if (dp[i][j] === dp[i - 1][j - 1] + substitutionCost) {
        if (substitutionCost === 0) {
          states[i - 1] = "correct";
          correct += 1;
        } else {
          states[i - 1] = "wrong";
          wrong += 1;
        }
        i -= 1;
        j -= 1;
        continue;
      }
    }

    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      states[i - 1] = "missed";
      missed += 1;
      i -= 1;
      continue;
    }

    if (j > 0) {
      extra += 1;
      j -= 1;
    }
  }

  return {
    states,
    currentIndex: endIndex,
    correct,
    wrong,
    missed,
    extra,
    isComplete: endIndex >= n && m >= n - missed,
  };
}

function updateTime() {
  const minutes = Math.floor(Math.max(state.secondsLeft, 0) / 60);
  const seconds = Math.max(state.secondsLeft, 0) % 60;
  els.timeLeft.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateSourcePreview() {
  els.charCount.textContent = `${state.sourceText.length} 字`;
  els.sourcePreview.textContent = state.sourceText;
  renderPrompt();
}

function setStatus(message) {
  els.statusText.textContent = message;
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function resolveMacauDailyUrl(value) {
  try {
    const url = new URL(value, els.urlInput.value || "https://www.macaodaily.com/");
    return url.href;
  } catch {
    return "";
  }
}

function isMacauDailyUrl(value) {
  try {
    const url = new URL(value);
    return /(^|\.)macaodaily\.com$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function isMacauDailyIndexUrl(value) {
  if (!isMacauDailyUrl(value)) return false;
  return /\/node_\d+\.htm(?:[?#].*)?$/i.test(new URL(value).pathname);
}

function isMacauDailyArticleUrl(value) {
  if (!isMacauDailyUrl(value)) return false;
  return /\/content_\d+\.htm(?:[?#].*)?$/i.test(new URL(value).pathname);
}

updateSourcePreview();
updateTime();
updateMetrics();
