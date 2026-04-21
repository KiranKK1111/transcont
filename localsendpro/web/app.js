// Minimal shared-room UI. Nothing identifying is shown — no room name,
// no folder path, no titles. The room is derived from the URL only.

const $ = (sel) => document.querySelector(sel);
const room = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");
const apiBase = `/api/${encodeURIComponent(room)}`;

// ---------- helpers ----------
function toast(msg, kind = "") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast show " + kind;
  setTimeout(() => { t.className = "toast " + kind; }, 2200);
}

function fmtBytes(n) {
  if (n == null) return "";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ---------- refresh (files + note) ----------
let lastNote = "";
let pollDelay = 2500;         // base interval
const POLL_MIN = 2500;
const POLL_MAX = 30000;       // back off to 30s on repeated errors

async function refresh() {
  try {
    const r = await fetch(apiBase);
    if (!r.ok) throw new Error(r.status + " " + r.statusText);
    const data = await r.json();
    renderFiles(data.files);
    if (document.activeElement !== $("#note") && data.note !== lastNote) {
      $("#note").value = data.note;
      lastNote = data.note;
    }
    pollDelay = POLL_MIN;     // success — go back to fast polling
  } catch {
    pollDelay = Math.min(pollDelay * 2, POLL_MAX);
  } finally {
    setTimeout(refresh, pollDelay);
  }
}

function renderFiles(files) {
  const list = $("#file-list");
  list.innerHTML = "";
  for (const f of files) {
    const when = new Date(f.at * 1000).toLocaleTimeString();
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="name">
        <a href="${apiBase}/dl/${encodeURIComponent(f.name)}" download>${escapeHtml(f.name)}</a>
      </div>
      <div class="meta">${fmtBytes(f.size)} · ${when}</div>
      <button class="del" data-name="${escapeHtml(f.name)}">×</button>
    `;
    list.appendChild(li);
  }
  list.querySelectorAll(".del").forEach(btn => {
    btn.addEventListener("click", () => deleteFile(btn.dataset.name));
  });
}

async function deleteFile(name) {
  try {
    await fetch(`${apiBase}/dl/${encodeURIComponent(name)}`, { method: "DELETE" });
    refresh();
  } catch { toast("Delete failed", "err"); }
}

// ---------- uploads ----------
const progEl = $("#upload-progress");
const progFill = $("#upload-fill");
const progPct = $("#upload-pct");
const progLabel = $("#upload-label");

function showProgress(label) {
  progLabel.textContent = label;
  progPct.textContent = "0%";
  progFill.style.width = "0%";
  progEl.classList.remove("hidden");
}
function setProgress(loaded, total) {
  const pct = total ? Math.round((loaded / total) * 100) : 0;
  progFill.style.width = pct + "%";
  progPct.textContent = `${pct}%  (${fmtBytes(loaded)} / ${fmtBytes(total)})`;
}
function hideProgress() {
  setTimeout(() => progEl.classList.add("hidden"), 400);
}

function uploadFiles(fileList) {
  if (!fileList || !fileList.length) return;
  const files = Array.from(fileList);
  const fd = new FormData();
  let total = 0;
  for (const f of files) { fd.append("files", f, f.name); total += f.size; }

  showProgress(
    files.length === 1 ? files[0].name : `${files.length} files (${fmtBytes(total)})`
  );

  const xhr = new XMLHttpRequest();
  xhr.open("POST", apiBase);
  xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(e.loaded, e.total); };
  xhr.upload.onload = () => setProgress(total, total);
  xhr.onload = () => {
    hideProgress();
    if (xhr.status >= 200 && xhr.status < 300) {
      toast("Uploaded ✓", "ok");
      refresh();
    } else {
      toast("Upload failed", "err");
    }
  };
  xhr.onerror = () => { hideProgress(); toast("Upload failed", "err"); };
  xhr.send(fd);
}

// ---------- note (debounced save) ----------
let noteTimer = null;
$("#note").addEventListener("input", () => {
  clearTimeout(noteTimer);
  noteTimer = setTimeout(saveNote, 500);
});
async function saveNote() {
  const text = $("#note").value;
  try {
    const r = await fetch(`${apiBase}/note`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) throw new Error();
    lastNote = text;
  } catch { /* silent */ }
}

// ---------- room controls ----------
$("#btn-copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(location.href); toast("Link copied ✓", "ok"); }
  catch { toast("Copy failed", "err"); }
});
$("#btn-new").addEventListener("click", () => { location.href = "/"; });

// ---------- drag & drop ----------
const drop = $("#drop");
["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => {
  e.preventDefault(); drop.classList.add("dragover");
}));
["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => {
  e.preventDefault(); drop.classList.remove("dragover");
}));
drop.addEventListener("drop", e => {
  if (e.dataTransfer?.files?.length) uploadFiles(e.dataTransfer.files);
});
$("#file-input").addEventListener("change", e => {
  uploadFiles(e.target.files);
  e.target.value = "";
});

// ---------- boot ----------
refresh();  // schedules itself via setTimeout with exponential backoff on errors
