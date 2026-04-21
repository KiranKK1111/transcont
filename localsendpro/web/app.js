// Peer-to-peer room client. The server only relays signalling; file bytes
// and the shared note travel directly between browsers over RTCDataChannels.

const $ = (sel) => document.querySelector(sel);
const room = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");

const CHUNK_SIZE = 16 * 1024;
const BUFFER_HIGH = 1 * 1024 * 1024;
const BUFFER_LOW = 256 * 1024;
const RTC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

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

// ---------- signalling ----------
let selfId = null;
const peers = new Map();  // peerId -> { pc, dc, incoming }

function updatePeerCount() {
  const open = [...peers.values()].filter(p => p.dc && p.dc.readyState === "open").length;
  const label = open === 0 ? "no peers — share the URL" :
                open === 1 ? "1 peer connected" :
                             `${open} peers connected`;
  $("#peer-count").textContent = label;
}

const wsProto = location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(`${wsProto}//${location.host}/ws/${encodeURIComponent(room)}`);

ws.addEventListener("message", async (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.type === "hello") {
    selfId = msg.self;
    for (const id of msg.peers) await initiateConnection(id);
    updatePeerCount();
  } else if (msg.type === "peer-joined") {
    // The newcomer initiates; we just wait for their offer.
  } else if (msg.type === "peer-left") {
    const p = peers.get(msg.id);
    if (p) { try { p.pc.close(); } catch {} peers.delete(msg.id); }
    updatePeerCount();
  } else if (msg.type === "offer") {
    await handleOffer(msg.from, msg.sdp);
  } else if (msg.type === "answer") {
    const p = peers.get(msg.from);
    if (p) await p.pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
  } else if (msg.type === "candidate") {
    const p = peers.get(msg.from);
    if (p && msg.candidate) {
      try { await p.pc.addIceCandidate(msg.candidate); } catch {}
    }
  }
});

ws.addEventListener("close", () => {
  $("#peer-count").textContent = "disconnected";
});

function signal(to, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ to, ...payload }));
}

function newPeerConnection(peerId) {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  pc.onicecandidate = (e) => {
    if (e.candidate) signal(peerId, { type: "candidate", candidate: e.candidate });
  };
  pc.onconnectionstatechange = () => {
    if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
      updatePeerCount();
    }
  };
  return pc;
}

async function initiateConnection(peerId) {
  const pc = newPeerConnection(peerId);
  const dc = pc.createDataChannel("data", { ordered: true });
  wireDataChannel(dc, peerId);
  const entry = { pc, dc, incoming: null };
  peers.set(peerId, entry);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  signal(peerId, { type: "offer", sdp: offer.sdp });
}

async function handleOffer(peerId, sdp) {
  const pc = newPeerConnection(peerId);
  const entry = { pc, dc: null, incoming: null };
  peers.set(peerId, entry);
  pc.ondatachannel = (e) => {
    entry.dc = e.channel;
    wireDataChannel(entry.dc, peerId);
  };
  await pc.setRemoteDescription({ type: "offer", sdp });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  signal(peerId, { type: "answer", sdp: answer.sdp });
}

// ---------- data channel wiring ----------
function wireDataChannel(dc, peerId) {
  dc.binaryType = "arraybuffer";
  const entry = peers.get(peerId);

  dc.onopen = () => {
    updatePeerCount();
    // Send current note to the new peer so they pick up what's on screen.
    const text = $("#note").value;
    if (text) safeSend(dc, JSON.stringify({ type: "note", text }));
  };
  dc.onclose = () => { updatePeerCount(); };

  dc.onmessage = (e) => {
    if (typeof e.data === "string") {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === "file-start") {
        entry.incoming = { id: msg.id, name: msg.name, size: msg.size, mime: msg.mime, chunks: [], received: 0 };
      } else if (msg.type === "file-end") {
        if (!entry.incoming) return;
        const { name, size, mime, chunks } = entry.incoming;
        const blob = new Blob(chunks, mime ? { type: mime } : {});
        addReceivedFile(blob, name, size, peerId);
        entry.incoming = null;
      } else if (msg.type === "note") {
        applyIncomingNote(msg.text);
      }
    } else {
      if (!entry.incoming) return;
      entry.incoming.chunks.push(e.data);
      entry.incoming.received += e.data.byteLength;
    }
  };
}

function safeSend(dc, data) {
  try { dc.send(data); } catch {}
}

// ---------- received files ----------
function addReceivedFile(blob, name, size, fromPeer) {
  const url = URL.createObjectURL(blob);
  const when = new Date().toLocaleTimeString();
  const li = document.createElement("li");
  const shortId = fromPeer.slice(0, 4);
  li.innerHTML = `
    <div class="name">
      <a href="${url}" download="${escapeHtml(name)}">${escapeHtml(name)}</a>
    </div>
    <div class="meta">${fmtBytes(size)} · ${when} · from ${escapeHtml(shortId)}</div>
    <button class="del">×</button>
  `;
  li.querySelector(".del").addEventListener("click", () => {
    URL.revokeObjectURL(url);
    li.remove();
  });
  $("#file-list").appendChild(li);
  toast(`Received ${name}`, "ok");
}

// ---------- sending files ----------
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

function waitForDrain(dc) {
  if (dc.bufferedAmount < BUFFER_HIGH) return Promise.resolve();
  dc.bufferedAmountLowThreshold = BUFFER_LOW;
  return new Promise((resolve) => {
    dc.addEventListener("bufferedamountlow", resolve, { once: true });
  });
}

async function sendFileOverChannel(dc, file, fileId, onProgress) {
  dc.send(JSON.stringify({
    type: "file-start", id: fileId,
    name: file.name, size: file.size, mime: file.type,
  }));
  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const buf = await file.slice(offset, end).arrayBuffer();
    await waitForDrain(dc);
    dc.send(buf);
    offset = end;
    onProgress(offset);
  }
  dc.send(JSON.stringify({ type: "file-end", id: fileId }));
}

async function sendFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const openDcs = [...peers.values()]
    .map(p => p.dc)
    .filter(dc => dc && dc.readyState === "open");
  if (!openDcs.length) { toast("No peers connected", "err"); return; }

  const totalAll = files.reduce((s, f) => s + f.size, 0);
  let sentBase = 0;

  showProgress(
    files.length === 1 ? files[0].name : `${files.length} files (${fmtBytes(totalAll)})`
  );

  try {
    for (const file of files) {
      const fileId = (crypto.randomUUID?.() || String(Math.random()).slice(2));
      const progress = new Array(openDcs.length).fill(0);
      await Promise.all(openDcs.map((dc, i) =>
        sendFileOverChannel(dc, file, fileId, (sent) => {
          progress[i] = sent;
          const slowest = Math.min(...progress);
          setProgress(sentBase + slowest, totalAll);
        })
      ));
      sentBase += file.size;
    }
    setProgress(totalAll, totalAll);
    toast("Sent ✓", "ok");
  } catch {
    toast("Send failed", "err");
  } finally {
    hideProgress();
  }
}

// ---------- note sync ----------
let lastNote = "";
let noteTimer = null;

$("#note").addEventListener("input", () => {
  clearTimeout(noteTimer);
  noteTimer = setTimeout(broadcastNote, 300);
});

function broadcastNote() {
  const text = $("#note").value;
  if (text === lastNote) return;
  lastNote = text;
  const payload = JSON.stringify({ type: "note", text });
  for (const p of peers.values()) {
    if (p.dc && p.dc.readyState === "open") safeSend(p.dc, payload);
  }
}

function applyIncomingNote(text) {
  if (document.activeElement === $("#note")) return;
  $("#note").value = text;
  lastNote = text;
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
  if (e.dataTransfer?.files?.length) sendFiles(e.dataTransfer.files);
});
$("#file-input").addEventListener("change", e => {
  sendFiles(e.target.files);
  e.target.value = "";
});
