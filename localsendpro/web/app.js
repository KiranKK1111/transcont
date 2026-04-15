// Shared-room UI. The room name is the last URL segment: /r/<room>.

const $ = (sel) => document.querySelector(sel);
const room = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");
const apiBase = `/api/${encodeURIComponent(room)}`;

$("#room-name").textContent = room;

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

// ---------- room state ----------
let lastNote = "";

async function refresh() {
  try {
    const r = await fetch(apiBase);
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    renderFiles(data.files);
    // Don't clobber the textarea while the user is typing
    if (document.activeElement !== $("#note") && data.note !== lastNote) {
      $("#note").value = data.note;
      lastNote = data.note;
    }
  } catch (e) { /* swallow polling errors */ }
}

function renderFiles(files) {
  const list = $("#file-list");
  const empty = $("#file-empty");
  list.innerHTML = "";
  if (!files.length) { empty.style.display = ""; return; }
  empty.style.display = "none";
  for (const f of files) {
    const when = new Date(f.at * 1000).toLocaleTimeString();
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="name">
        <a href="${apiBase}/dl/${encodeURIComponent(f.name)}" download>${escapeHtml(f.name)}</a>
      </div>
      <div class="meta">${fmtBytes(f.size)} · ${when}</div>
      <button class="del" data-name="${escapeHtml(f.name)}">Delete</button>
    `;
    list.appendChild(li);
  }
  list.querySelectorAll(".del").forEach(btn => {
    btn.addEventListener("click", () => deleteFile(btn.dataset.name));
  });
}

// ---------- uploads ----------
async function uploadFiles(fileList) {
  if (!fileList || !fileList.length) return;
  const fd = new FormData();
  for (const f of fileList) fd.append("files", f, f.name);
  try {
    const r = await fetch(`${apiBase}/upload`, { method: "POST", body: fd });
    if (!r.ok) throw new Error(await r.text());
    const j = await r.json();
    toast(`Uploaded ${j.saved} file(s) ✓`, "ok");
    refresh();
  } catch (e) {
    toast("Upload failed: " + e.message, "err");
  }
}

async function deleteFile(name) {
  try {
    await fetch(`${apiBase}/dl/${encodeURIComponent(name)}`, { method: "DELETE" });
    refresh();
  } catch (e) { toast("Delete failed", "err"); }
}

// ---------- note (debounced save) ----------
let noteTimer = null;
$("#note").addEventListener("input", () => {
  $("#note-status").textContent = "saving…";
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
    if (!r.ok) throw new Error(await r.text());
    lastNote = text;
    $("#note-status").textContent = "saved";
  } catch {
    $("#note-status").textContent = "save failed";
  }
}

// ---------- room controls ----------
$("#btn-copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    toast("Link copied ✓", "ok");
  } catch { toast("Copy failed", "err"); }
});

$("#btn-new").addEventListener("click", () => {
  location.href = "/";
});

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
refresh();
setInterval(refresh, 2500);
