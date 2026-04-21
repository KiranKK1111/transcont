// All CodeMirror imports pin the same @codemirror/state, @codemirror/view,
// and @codemirror/language instances via esm.sh's ?deps= param so every
// extension registers against a single EditorView class.
import { EditorState, Compartment } from "https://esm.sh/@codemirror/state@6.4.1";
import {
  EditorView, keymap, lineNumbers, highlightActiveLine,
  highlightActiveLineGutter, drawSelection, dropCursor,
  rectangularSelection, crosshairCursor,
} from "https://esm.sh/@codemirror/view@6.26.3?deps=@codemirror/state@6.4.1";
import {
  defaultKeymap, history, historyKeymap, indentWithTab,
} from "https://esm.sh/@codemirror/commands@6.3.3?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3";
import {
  syntaxHighlighting, defaultHighlightStyle,
  bracketMatching, indentOnInput, foldGutter, foldKeymap,
} from "https://esm.sh/@codemirror/language@6.10.1?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3";
import {
  searchKeymap, highlightSelectionMatches,
} from "https://esm.sh/@codemirror/search@6.5.6?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3";
import {
  autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap,
} from "https://esm.sh/@codemirror/autocomplete@6.12.0?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3,@codemirror/language@6.10.1";
import {
  lintKeymap,
} from "https://esm.sh/@codemirror/lint@6.5.0?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3";
import {
  oneDark,
} from "https://esm.sh/@codemirror/theme-one-dark@6.1.2?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3,@codemirror/language@6.10.1";

import { javascript } from "https://esm.sh/@codemirror/lang-javascript@6.2.2?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3,@codemirror/language@6.10.1";
import { html as langHtml } from "https://esm.sh/@codemirror/lang-html@6.4.9?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3,@codemirror/language@6.10.1";
import { css as langCss }  from "https://esm.sh/@codemirror/lang-css@6.2.1?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3,@codemirror/language@6.10.1";
import { python }          from "https://esm.sh/@codemirror/lang-python@6.1.5?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3,@codemirror/language@6.10.1";
import { java }            from "https://esm.sh/@codemirror/lang-java@6.0.1?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3,@codemirror/language@6.10.1";
import { cpp }             from "https://esm.sh/@codemirror/lang-cpp@6.0.2?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3,@codemirror/language@6.10.1";
import { php }             from "https://esm.sh/@codemirror/lang-php@6.0.1?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3,@codemirror/language@6.10.1";
import { rust }            from "https://esm.sh/@codemirror/lang-rust@6.0.1?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3,@codemirror/language@6.10.1";
import { sql }             from "https://esm.sh/@codemirror/lang-sql@6.6.4?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3,@codemirror/language@6.10.1";
import { json as langJson }from "https://esm.sh/@codemirror/lang-json@6.0.1?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3,@codemirror/language@6.10.1";
import { xml }             from "https://esm.sh/@codemirror/lang-xml@6.1.0?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3,@codemirror/language@6.10.1";
import { markdown }        from "https://esm.sh/@codemirror/lang-markdown@6.2.5?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3,@codemirror/language@6.10.1";
import { yaml }            from "https://esm.sh/@codemirror/lang-yaml@6.1.1?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3,@codemirror/language@6.10.1";
import { go }              from "https://esm.sh/@codemirror/lang-go@6.0.0?deps=@codemirror/state@6.4.1,@codemirror/view@6.26.3,@codemirror/language@6.10.1";

const $ = (s) => document.querySelector(s);

const SLUG = decodeURIComponent(location.pathname.split("/").filter(Boolean)[0] || "");
const API = `/api/ws/${encodeURIComponent(SLUG)}`;

// icon: short badge text; bg/fg: badge colors; tint: on-theme text color used
// for the picker label and active file name in the sidebar.
const LANGUAGES = [
  { id: "plaintext",  label: "Plain Text",  icon: "Aa",  bg: "#4c4c4c", fg: "#fff", tint: "#9aa3b2", ext: null },
  { id: "javascript", label: "JavaScript",  icon: "JS",  bg: "#f7df1e", fg: "#000", tint: "#f7df1e", ext: () => javascript() },
  { id: "typescript", label: "TypeScript",  icon: "TS",  bg: "#3178c6", fg: "#fff", tint: "#6aa6ff", ext: () => javascript({ typescript: true }) },
  { id: "html",       label: "HTML",        icon: "</>", bg: "#e34f26", fg: "#fff", tint: "#ff8560", ext: () => langHtml() },
  { id: "css",        label: "CSS",         icon: "{}",  bg: "#2965f1", fg: "#fff", tint: "#6d96ff", ext: () => langCss() },
  { id: "python",     label: "Python",      icon: "Py",  bg: "#3776ab", fg: "#ffd43b", tint: "#6aa4d4", ext: () => python() },
  { id: "java",       label: "Java",        icon: "Jv",  bg: "#ed8b00", fg: "#fff", tint: "#ffb04d", ext: () => java() },
  { id: "cpp",        label: "C++",         icon: "C++", bg: "#00599c", fg: "#fff", tint: "#5aa0d4", ext: () => cpp() },
  { id: "csharp",     label: "C#",          icon: "C#",  bg: "#512bd4", fg: "#fff", tint: "#9b7aff", ext: null },
  { id: "php",        label: "PHP",         icon: "PHP", bg: "#777bb4", fg: "#fff", tint: "#a9adda", ext: () => php() },
  { id: "ruby",       label: "Ruby",        icon: "Rb",  bg: "#cc342d", fg: "#fff", tint: "#ff6b6b", ext: null },
  { id: "go",         label: "Go",          icon: "Go",  bg: "#00add8", fg: "#fff", tint: "#4ecfe0", ext: () => go() },
  { id: "rust",       label: "Rust",        icon: "Rs",  bg: "#b7410e", fg: "#fff", tint: "#e08063", ext: () => rust() },
  { id: "sql",        label: "SQL",         icon: "SQL", bg: "#336791", fg: "#fff", tint: "#6ba3d0", ext: () => sql() },
  { id: "json",       label: "JSON",        icon: "{}",  bg: "#1da1a1", fg: "#fff", tint: "#55d4d4", ext: () => langJson() },
  { id: "xml",        label: "XML",         icon: "<>",  bg: "#e91e63", fg: "#fff", tint: "#ff7eac", ext: () => xml() },
  { id: "markdown",   label: "Markdown",    icon: "MD",  bg: "#083fa1", fg: "#fff", tint: "#6a8fd4", ext: () => markdown() },
  { id: "yaml",       label: "YAML",        icon: "YML", bg: "#cb171e", fg: "#fff", tint: "#ff6b70", ext: () => yaml() },
  { id: "kotlin",     label: "Kotlin",      icon: "Kt",  bg: "#7f52ff", fg: "#fff", tint: "#b69aff", ext: null },
  { id: "elixir",     label: "Elixir",      icon: "Ex",  bg: "#4b275f", fg: "#fff", tint: "#a77bc0", ext: null },
  { id: "scala",      label: "Scala",       icon: "Sc",  bg: "#dc322f", fg: "#fff", tint: "#ff6f6b", ext: null },
  { id: "swift",      label: "Swift",       icon: "Sw",  bg: "#fa7343", fg: "#fff", tint: "#ff9968", ext: null },
  { id: "powershell", label: "PowerShell",  icon: "PS",  bg: "#012456", fg: "#fff", tint: "#5e8bc4", ext: null },
  { id: "bash",       label: "Bash",        icon: "$_",  bg: "#4eaa25", fg: "#fff", tint: "#7fd14a", ext: null },
];
const LANG_BY_ID = Object.fromEntries(LANGUAGES.map(l => [l.id, l]));

const EXT_TO_LANG = {
  js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
  ts: "typescript", tsx: "typescript",
  html: "html", htm: "html",
  css: "css", scss: "css", sass: "css", less: "css",
  py: "python", pyw: "python",
  java: "java",
  cpp: "cpp", cc: "cpp", cxx: "cpp", c: "cpp", h: "cpp", hpp: "cpp",
  cs: "csharp",
  php: "php", phtml: "php",
  rb: "ruby", erb: "ruby",
  go: "go",
  rs: "rust",
  sql: "sql",
  json: "json", jsonc: "json",
  xml: "xml", svg: "xml",
  md: "markdown", markdown: "markdown", mdx: "markdown",
  yml: "yaml", yaml: "yaml",
  kt: "kotlin", kts: "kotlin",
  ex: "elixir", exs: "elixir",
  scala: "scala", sc: "scala",
  swift: "swift",
  ps1: "powershell", psm1: "powershell",
  sh: "bash", bash: "bash", zsh: "bash",
};

function inferLangFromName(name) {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "plaintext";
  const ext = name.slice(dot + 1).toLowerCase();
  return EXT_TO_LANG[ext] || "plaintext";
}

function paintBadge(el, langId) {
  const def = LANG_BY_ID[langId] || LANG_BY_ID.plaintext;
  el.textContent = def.icon;
  el.style.setProperty("--badge-bg", def.bg);
  el.style.setProperty("--badge-fg", def.fg);
}

const basicExtensions = () => [
  lineNumbers(), highlightActiveLineGutter(), history(), foldGutter(),
  drawSelection(), dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(), closeBrackets(), autocompletion(),
  rectangularSelection(), crosshairCursor(),
  highlightActiveLine(), highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap,
    ...historyKeymap, ...foldKeymap, ...completionKeymap, ...lintKeymap,
    indentWithTab,
  ]),
];

// ---------- toast ----------
function toast(msg, kind = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast show " + kind;
  setTimeout(() => { t.className = "toast " + kind; }, 1800);
}

// ---------- confirm modal ----------
function confirmModal({ title, message, okLabel = "Delete", okKind = "danger" }) {
  return new Promise((resolve) => {
    const backdrop = $("#modal-backdrop");
    const okBtn    = $("#modal-ok");
    const cancelBtn= $("#modal-cancel");
    $("#modal-title").textContent   = title;
    $("#modal-message").textContent = message;
    okBtn.textContent = okLabel;
    okBtn.className   = "modal-ok " + okKind;

    const cleanup = (result) => {
      backdrop.classList.add("hidden");
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      backdrop.removeEventListener("mousedown", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };
    const onOk      = () => cleanup(true);
    const onCancel  = () => cleanup(false);
    const onBackdrop= (e) => { if (e.target === backdrop) cleanup(false); };
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); cleanup(false); }
      else if (e.key === "Enter") { e.preventDefault(); cleanup(true); }
    };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    backdrop.addEventListener("mousedown", onBackdrop);
    document.addEventListener("keydown", onKey);

    backdrop.classList.remove("hidden");
    okBtn.focus();
  });
}

// ---------- theme ----------
const themeCompartment = new Compartment();
function darkActive() { return document.body.classList.contains("dark"); }
function themeExt() { return darkActive() ? oneDark : []; }

const themeBtn = $("#theme-toggle");
function applyTheme(mode) {
  document.body.classList.toggle("dark", mode === "dark");
  document.body.classList.toggle("light", mode === "light");
  themeBtn.innerHTML = mode === "dark" ? "&#9790;" : "&#9728;";
  if (view) view.dispatch({ effects: themeCompartment.reconfigure(themeExt()) });
}
themeBtn.addEventListener("click", () => {
  const next = darkActive() ? "light" : "dark";
  localStorage.setItem("envpad-theme", next);
  applyTheme(next);
});

// ---------- sidebar toggle ----------
$("#sidebar-toggle").addEventListener("click", () => {
  document.body.classList.toggle("sidebar-collapsed");
});

// ---------- editor ----------
const langCompartment = new Compartment();
let view = null;
let currentDoc = null;   // { folder, name, language }
let suppressSave = false;
let saveTimer = null;
let savedClearTimer = null;
let inFlight = null;

function buildLangExt(langId) {
  const def = LANG_BY_ID[langId] || LANG_BY_ID.plaintext;
  return def.ext ? def.ext() : [];
}

function mountEditor(initialText, langId) {
  const state = EditorState.create({
    doc: initialText,
    extensions: [
      ...basicExtensions(),
      themeCompartment.of(themeExt()),
      langCompartment.of(buildLangExt(langId)),
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !suppressSave) scheduleSave();
      }),
      EditorView.theme({
        "&":            { height: "100%" },
        ".cm-scroller": { fontFamily: "ui-monospace, Menlo, Consolas, monospace" },
      }),
    ],
  });
  view = new EditorView({ state, parent: $("#editor") });
  view.focus();
}

function applyLanguageChrome(langId) {
  const def = LANG_BY_ID[langId] || LANG_BY_ID.plaintext;
  paintBadge($("#lang-badge"), langId);
  $("#lang-label").textContent = def.label;
  $("#lang-btn").style.setProperty("--lang-color", def.tint);
}

function setLanguage(langId) {
  if (!view) return;
  view.dispatch({ effects: langCompartment.reconfigure(buildLangExt(langId)) });
  applyLanguageChrome(langId);
  if (currentDoc) currentDoc.language = langId;
  // Re-render doc list so the active entry picks up the new accent color.
  if (cachedDocs && currentDoc) renderFolderTree(cachedDocs, currentDoc.name);
}

// ---------- save pipeline ----------
const SAVE_DEBOUNCE_SMALL_MS = 700;
const SAVE_DEBOUNCE_LARGE_MS = 3000;
const LARGE_DOC_THRESHOLD    = 1 * 1024 * 1024;   // 1 MB
const SAVED_VISIBLE_MS       = 5000;

function scheduleSave() {
  clearTimeout(savedClearTimer);
  $("#save-indicator").classList.remove("fading");
  setSaveIndicator("Editing…");
  clearTimeout(saveTimer);
  const size = view?.state.doc.length || 0;
  const delay = size > LARGE_DOC_THRESHOLD ? SAVE_DEBOUNCE_LARGE_MS : SAVE_DEBOUNCE_SMALL_MS;
  saveTimer = setTimeout(saveNow, delay);
}

async function saveNow() {
  if (!view || !currentDoc) return;
  if (inFlight) inFlight.abort();
  inFlight = new AbortController();
  const content = view.state.doc.toString();
  const language = currentDoc.language || "plaintext";
  setSaveIndicator("Saving…");
  try {
    const url = `${API}/docs/${encodeURIComponent(currentDoc.name)}`
              + `?language=${encodeURIComponent(language)}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: content,
      signal: inFlight.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 120)}` : ""}`);
    }
    setSaveIndicator("Saved");
    scheduleSavedFade();
  } catch (err) {
    if (err.name === "AbortError") return;
    console.error("[envpad] save failed:", err);
    setSaveIndicator(`Save failed — ${err.message.slice(0, 60)}`);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 3000);
  } finally {
    inFlight = null;
  }
}

function setSaveIndicator(text) {
  const el = $("#save-indicator");
  el.textContent = text;
  el.classList.remove("fading");
}

function scheduleSavedFade() {
  clearTimeout(savedClearTimer);
  savedClearTimer = setTimeout(() => {
    const el = $("#save-indicator");
    el.classList.add("fading");
    setTimeout(() => {
      if (el.classList.contains("fading")) el.textContent = "";
    }, 400);
  }, SAVED_VISIBLE_MS);
}

window.addEventListener("beforeunload", (e) => {
  if (saveTimer) {
    saveNow();
    e.preventDefault();
    e.returnValue = "";
  }
});

// ---------- docs / folders ----------
let cachedDocs = null;

async function fetchDocs() {
  const res = await fetch(`${API}/docs`);
  if (!res.ok) throw new Error(`list docs failed: HTTP ${res.status}`);
  cachedDocs = await res.json();
  return cachedDocs;
}

function groupByFolder(docs) {
  const map = new Map();
  for (const d of docs) {
    const key = d.folder || SLUG;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(d);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function svgIcon(kind) {
  // compact inline SVGs for the add-file / add-folder / delete buttons.
  if (kind === "file-plus") return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="12" y1="12" x2="12" y2="18"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
    </svg>`;
  if (kind === "folder-plus") return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      <line x1="12" y1="11" x2="12" y2="17"/>
      <line x1="9" y1="14" x2="15" y2="14"/>
    </svg>`;
  if (kind === "trash") return `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
    </svg>`;
  return "";
}

function renderFolderTree(docs, activeName) {
  const root = $("#folder-tree");
  root.innerHTML = "";
  const groups = groupByFolder(docs);
  for (const [folder, items] of groups) {
    const block = document.createElement("div");
    block.className = "folder-block";
    block.innerHTML = `
      <div class="folder-row">
        <span class="folder-ico">📁</span>
        <span class="folder-name"></span>
        <span class="folder-actions">
          <button class="folder-action add-file" title="New file in this folder">${svgIcon("file-plus")}</button>
          <button class="folder-action add-folder" title="New folder">${svgIcon("folder-plus")}</button>
          <button class="folder-action delete-folder" title="Delete folder">${svgIcon("trash")}</button>
        </span>
      </div>
      <ul class="doc-list"></ul>
    `;
    block.querySelector(".folder-name").textContent = folder;
    block.querySelector(".add-file").addEventListener("click", (e) => {
      e.stopPropagation();
      beginInlineFileCreate(folder, block);
    });
    block.querySelector(".add-folder").addEventListener("click", (e) => {
      e.stopPropagation();
      beginInlineFolderCreate();
    });
    block.querySelector(".delete-folder").addEventListener("click", async (e) => {
      e.stopPropagation();
      const n = items.length;
      const ok = await confirmModal({
        title: "Delete folder",
        message: `Delete folder "${folder}" and ${n} file${n === 1 ? "" : "s"} inside? This can't be undone.`,
        okLabel: "Delete",
      });
      if (!ok) return;
      await deleteFolder(folder);
    });
    const ul = block.querySelector(".doc-list");
    for (const d of items) {
      const def = LANG_BY_ID[d.language] || LANG_BY_ID.plaintext;
      const li = document.createElement("li");
      li.className = "doc-item" + (d.name === activeName ? " active" : "");
      li.style.setProperty("--doc-accent", def.tint);
      li.innerHTML = `
        <span class="lang-badge" style="--badge-bg:${def.bg};--badge-fg:${def.fg}"></span>
        <span class="doc-name"></span>
        <button class="doc-del" title="Delete">×</button>
      `;
      li.querySelector(".lang-badge").textContent = def.icon;
      li.querySelector(".doc-name").textContent = d.name;
      li.addEventListener("click", (e) => {
        if (e.target.closest(".doc-del")) return;
        selectDoc(d.name);
      });
      li.querySelector(".doc-del").addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = await confirmModal({
          title: "Delete file",
          message: `Delete "${d.name}"? This can't be undone.`,
          okLabel: "Delete",
        });
        if (!ok) return;
        await deleteDoc(d.name);
      });
      ul.appendChild(li);
    }
    root.appendChild(block);
  }
}

async function selectDoc(name) {
  if (saveTimer) { clearTimeout(saveTimer); await saveNow(); }
  const res = await fetch(`${API}/docs/${encodeURIComponent(name)}`);
  if (!res.ok) { toast("Failed to load doc", "err"); return; }
  const doc = await res.json();
  currentDoc = { folder: doc.folder, name: doc.name, language: doc.language };
  suppressSave = true;
  if (view) view.destroy();
  $("#editor").innerHTML = "";
  mountEditor(doc.content || "", doc.language || "plaintext");
  applyLanguageChrome(doc.language || "plaintext");
  suppressSave = false;
  setSaveIndicator("");
  const docs = await fetchDocs();
  renderFolderTree(docs, doc.name);
  localStorage.setItem(`envpad-last:${SLUG}`, doc.name);
}

async function createDocRequest(name, folder, language = "plaintext") {
  const res = await fetch(`${API}/docs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, folder, language }),
  });
  if (!res.ok) {
    toast(res.status === 409 ? "Name already exists" : "Create failed", "err");
    return null;
  }
  return res.json();
}

// VS Code-style inline entry: Enter commits, Esc cancels, blur commits if the
// input is non-empty (and cancels if empty). The `commit` callback returns
// true on success so we can leave the row in place until the tree re-renders.
function attachInlineEntry(inputEl, row, commit) {
  let done = false;
  const finish = async (confirmed) => {
    if (done) return;
    done = true;
    const name = inputEl.value.trim();
    if (!confirmed || !name) { row.remove(); return; }
    const ok = await commit(name);
    if (!ok) row.remove();
  };
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter")  { e.preventDefault(); finish(true); }
    else if (e.key === "Escape") { e.preventDefault(); finish(false); }
  });
  inputEl.addEventListener("blur", () => setTimeout(() => finish(true), 0));
  inputEl.focus();
}

function beginInlineFileCreate(folder, block) {
  const ul = block.querySelector(".doc-list");
  const li = document.createElement("li");
  li.className = "doc-item pending";
  li.innerHTML = `
    <span class="lang-badge"></span>
    <input type="text" class="inline-name-input" spellcheck="false" autocomplete="off" />
  `;
  const badge = li.querySelector(".lang-badge");
  const input = li.querySelector("input");
  paintBadge(badge, "plaintext");
  input.addEventListener("input", () => paintBadge(badge, inferLangFromName(input.value)));
  ul.insertBefore(li, ul.firstChild);
  attachInlineEntry(input, li, async (name) => {
    const lang = inferLangFromName(name);
    const created = await createDocRequest(name, folder, lang);
    if (!created) return false;
    await selectDoc(name);
    return true;
  });
}

function beginInlineFolderCreate() {
  const root = $("#folder-tree");
  const block = document.createElement("div");
  block.className = "folder-block pending";
  block.innerHTML = `
    <div class="folder-row">
      <span class="folder-ico">📁</span>
      <input type="text" class="inline-name-input" spellcheck="false" autocomplete="off" />
    </div>
  `;
  root.insertBefore(block, root.firstChild);
  attachInlineEntry(block.querySelector("input"), block, async (name) => {
    const created = await createDocRequest(name, name, "plaintext");
    if (!created) return false;
    await selectDoc(name);
    return true;
  });
}

function clearActiveEditor() {
  clearTimeout(saveTimer); saveTimer = null;
  clearTimeout(savedClearTimer); savedClearTimer = null;
  if (inFlight) { inFlight.abort(); inFlight = null; }
  if (view) { view.destroy(); view = null; }
  $("#editor").innerHTML = "";
  setSaveIndicator("");
  applyLanguageChrome("plaintext");
  currentDoc = null;
}

async function deleteDoc(name) {
  const deletingActive = currentDoc?.name === name;
  if (deletingActive) clearActiveEditor();
  const res = await fetch(`${API}/docs/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (!res.ok) { toast("Delete failed", "err"); return; }
  const docs = await fetchDocs();
  const next = docs[0];
  if (next) await selectDoc(next.name);
  else renderFolderTree([], null);
}

async function deleteFolder(folder) {
  const deletingActive = currentDoc?.folder === folder;
  if (deletingActive) clearActiveEditor();
  const res = await fetch(`${API}/folders/${encodeURIComponent(folder)}`, { method: "DELETE" });
  if (!res.ok) { toast("Delete failed", "err"); return; }
  const docs = await fetchDocs();
  const next = docs[0];
  if (next) await selectDoc(next.name);
  else renderFolderTree([], null);
}

// ---------- language picker ----------
function buildLangMenu() {
  const menu = $("#lang-menu");
  menu.innerHTML = "";
  for (const lang of LANGUAGES) {
    const li = document.createElement("li");
    li.className = "lang-item";
    li.dataset.id = lang.id;
    li.innerHTML = `
      <span class="lang-badge" style="--badge-bg:${lang.bg};--badge-fg:${lang.fg}"></span>
      <span class="lang-item-label"></span>
    `;
    li.querySelector(".lang-badge").textContent = lang.icon;
    li.querySelector(".lang-item-label").textContent = lang.label;
    li.addEventListener("click", () => {
      setLanguage(lang.id);
      menu.classList.add("hidden");
      if (currentDoc) scheduleSave();
    });
    menu.appendChild(li);
  }
}
buildLangMenu();

$("#lang-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  const menu = $("#lang-menu");
  menu.classList.toggle("hidden");
  if (!menu.classList.contains("hidden") && currentDoc) {
    for (const li of menu.querySelectorAll(".lang-item")) {
      li.classList.toggle("active", li.dataset.id === currentDoc.language);
    }
  }
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".lang-picker")) $("#lang-menu").classList.add("hidden");
});

// ---------- boot ----------
applyTheme(localStorage.getItem("envpad-theme") || "dark");
applyLanguageChrome("plaintext");

(async function boot() {
  try {
    const docs = await fetchDocs();
    const last = localStorage.getItem(`envpad-last:${SLUG}`);
    const pick = docs.find(d => d.name === last) || docs[0];
    if (!pick) { renderFolderTree([], null); return; }
    await selectDoc(pick.name);
  } catch (err) {
    console.error("[envpad] boot failed:", err);
    toast("Failed to load workspace — see console", "err");
  }
})();
