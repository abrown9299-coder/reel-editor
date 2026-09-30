/* Reel Editor — hand-built port of the Reel Pipeline artifact.
   Single-user personal tool. All state lives in this device's localStorage;
   nothing is sent anywhere. */
"use strict";

/* ---------- helpers ---------- */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
function esc(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function todayLocal() {
  const n = new Date(), p = (x) => String(x).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}
function average(vals) {
  const u = vals.filter((v) => v !== null && v !== undefined);
  return u.length ? u.reduce((s, v) => s + v, 0) / u.length : null;
}
function fmtNumber(v) {
  if (v === null || v === undefined) return "—";
  return Intl.NumberFormat("en-US", {
    notation: v >= 10000 ? "compact" : "standard", maximumFractionDigits: 1,
  }).format(v);
}
function scoreTone(t) { return t === null ? "unscored" : t >= 40 ? "hot" : t >= 30 ? "warm" : "cool"; }
function totalScore(c) {
  const s = [c.hook, c.crowd, c.lighting, c.audio, c.face];
  return s.every((v) => v !== null && v !== undefined) ? s.reduce((a, b) => a + b, 0) : null;
}

/* ---------- field definitions (mirror the original) ---------- */
const scoreFields = [
  { key: "hook", label: "First 2-sec hook" },
  { key: "crowd", label: "Crowd energy" },
  { key: "lighting", label: "Lighting quality" },
  { key: "audio", label: "Audio cleanliness" },
  { key: "face", label: "Aaron's face on camera" },
];
const metricFields = [
  { key: "views", label: "Views" }, { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" }, { key: "shares", label: "Shares" },
  { key: "saves", label: "Saves" },
];
const checklistFields = [
  { key: "hook_first", label: "Hook lands inside 2 seconds", detail: "Open on the strongest face, voice, or crowd beat." },
  { key: "face_forward", label: "Aaron is face-forward", detail: "Use Aaron's face or voice where the footage supports it." },
  { key: "welcoming_energy", label: "Crowd reads fun + welcoming", detail: "Favor connection and real room energy." },
  { key: "burned_captions", label: "Talking is captioned", detail: "Burn in captions for every spoken or hype moment." },
  { key: "vertical_format", label: "9:16 vertical", detail: "Frame for Reels without hiding the action." },
  { key: "duration_target", label: "15–30 second cut", detail: "Keep only the beats that earn their time." },
  { key: "minimal_text", label: "Minimal early overlays", detail: "Never cover faces, decks, or the drop." },
  { key: "original_audio", label: "Original show audio", detail: "Normalize it; no random trending-audio swap." },
  { key: "original_quality", label: "Original resolution + bitrate", detail: "Never upscale or inflate the source." },
  { key: "h264_profile", label: "H.264 high / yuv420p", detail: "Instagram-safe delivery profile." },
  { key: "single_encode", label: "Single encode from source", detail: "Avoid generational quality loss." },
  { key: "audio_quality", label: "AAC 128 kbps+ normalized", detail: "Clean level without clipping." },
];
const statusLabels = {
  uploaded: "Uploaded", concept: "Concept", chosen: "Chosen", editing: "Editing",
  ready_for_review: "Ready for review", approved: "Approved", posted: "Posted",
};

/* ---------- store ---------- */
const KEY = "reelEditor.v1";
function blankClip() {
  return {
    id: 0, name: "", event_name: "", date_shot: todayLocal(), notes: "", video_ref: null,
    hook: null, crowd: null, lighting: null, audio: null, face: null, scored_by: null,
    cut_in: null, cut_out: null, caption: "", hashtags: "",
    posted_to_ig: false, date_posted: null, ig_post_link: null,
    views: null, likes: null, comments: null, shares: null, saves: null,
  };
}
function blankConcept() {
  const c = {
    id: 0, clip_id: 0, clip_name: "", event_name: "", name: "",
    hook_description: "", cut_plan: "", caption_angle: "", status: "uploaded",
    caption_draft: "", hashtags_draft: "", ig_post_link: null,
  };
  checklistFields.forEach((f) => { c[f.key] = false; });
  return c;
}
function seed() {
  const clips = [
    Object.assign(blankClip(), {
      id: 1, name: "[EXAMPLE] jj_reloadit finals set — DELETE BEFORE REAL USE",
      event_name: "Nashville Beatdown Championship", date_shot: "2026-09-26",
      notes: "Example clip for learning the pipeline.",
      hook: 9, crowd: 8, lighting: 7, audio: 8, face: 9, scored_by: "Vesper",
      caption: "Finals energy from Nashville Beatdown Championship.",
      hashtags: "#nashvilleedm #bassmusic", posted_to_ig: true,
      views: 12500, likes: 890, comments: 45, shares: 120, saves: 60,
    }),
    Object.assign(blankClip(), {
      id: 2, name: "[EXAMPLE] crowd drop reaction — DELETE BEFORE REAL USE",
      event_name: "Nashville Beatdown Championship", date_shot: "2026-09-26",
      notes: "Example clip for learning the pipeline.",
      hook: 7, crowd: 7, lighting: 6, audio: 7, face: 5, scored_by: "Vesper",
    }),
    Object.assign(blankClip(), {
      id: 3, name: "[EXAMPLE] opening lights sweep — DELETE BEFORE REAL USE",
      event_name: "Nashville Beatdown Championship", date_shot: "2026-09-26",
      notes: "Example clip for learning the pipeline.",
      hook: 5, crowd: 6, lighting: 5, audio: 6, face: 4, scored_by: "Vesper",
    }),
  ];
  return { clips, concepts: [], queueOrder: [1, 2, 3], clipSeq: 100, conceptSeq: 100 };
}
let db;
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { db = seed(); save(); return; }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.clips)) throw new Error("bad shape");
    db = Object.assign(seed(), parsed);
  } catch (e) { db = seed(); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* storage full/blocked */ }
}
function getClip(id) { return db.clips.find((c) => c.id === id) || null; }
function scoreSort(a, b) {
  const ta = totalScore(a), tb = totalScore(b);
  if (ta === null && tb === null) return 0;
  if (ta === null) return 1;
  if (tb === null) return -1;
  return tb - ta;
}
function autoOrder() {
  const un = db.clips.filter((c) => !c.posted_to_ig).sort(scoreSort);
  const po = db.clips.filter((c) => c.posted_to_ig).sort(scoreSort);
  return un.concat(po).map((c) => c.id);
}
function orderedClips() {
  const byId = new Map(db.clips.map((c) => [c.id, c]));
  const ids = db.queueOrder.filter((id) => byId.has(id));
  db.clips.forEach((c) => { if (!ids.includes(c.id)) ids.push(c.id); });
  return ids.map((id) => byId.get(id));
}

/* ---------- router / shell ---------- */
let view = "dashboard";
let detailId = null;
let composerOpen = false;

function navigate(next, id) {
  view = next;
  detailId = next === "detail" ? (id || null) : null;
  if (next !== "production") composerOpen = false;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function openDetail(id) { navigate("detail", id); }

const navItems = [
  { view: "dashboard", label: "Dashboard", mark: "D" },
  { view: "production", label: "Production", mark: "▶" },
  { view: "queue", label: "Queue", mark: "Q" },
  { view: "add", label: "Add clip", mark: "+" },
  { view: "performance", label: "Results", mark: "P" },
];
function renderNav() {
  $("#nav").innerHTML = navItems.map((it) =>
    `<button data-nav="${it.view}" class="${view === it.view ? "active" : ""}" ${view === it.view ? 'aria-current="page"' : ""}><b>${it.mark}</b><span>${it.label}</span></button>`
  ).join("");
  $("#nav").style.display = view === "detail" ? "none" : "";
}
function render() {
  const app = $("#app");
  if (view === "dashboard") app.innerHTML = viewDashboard();
  else if (view === "queue") app.innerHTML = viewQueue();
  else if (view === "add") app.innerHTML = viewAdd();
  else if (view === "detail") app.innerHTML = viewDetailShell();
  else if (view === "production") app.innerHTML = viewProduction();
  else if (view === "performance") app.innerHTML = viewPerformance();
  renderNav();
  bind(app);
}

function pageIntro(kicker, title, aside) {
  return `<header class="page-intro"><p class="kicker">${esc(kicker)}</p><div><h1>${esc(title)}</h1>${aside ? `<p>${aside}</p>` : ""}</div></header>`;
}
function scoreDial(total, small) {
  return `<div class="score-dial ${scoreTone(total)}${small ? " small" : ""}"><strong>${total === null ? "—" : total}</strong><span>/50</span></div>`;
}
function scoreBars(clip, compact) {
  return `<div class="score-bars${compact ? " compact" : ""}">` + scoreFields.map((f) => {
    const v = clip[f.key];
    return `<div title="${esc(f.label)}"><span>${esc(f.label.split(" ")[0])}</span><i><b style="width:${(v || 0) * 10}%"></b></i><strong>${v === null || v === undefined ? "—" : v}</strong></div>`;
  }).join("") + `</div>`;
}

/* ---------- dashboard ---------- */
function viewDashboard() {
  const ordered = orderedClips();
  const backlog = ordered.filter((c) => !c.posted_to_ig);
  const posted = ordered.filter((c) => c.posted_to_ig);
  const now = new Date();
  const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const postedThisWeek = posted.filter((c) => c.date_posted && new Date(c.date_posted + "T12:00:00") >= weekStart).length;
  const backlogAvg = average(backlog.map(totalScore));
  const postedAvg = average(posted.map(totalScore));
  const next = backlog.slice(0, 3);
  const lead = next[0];
  const examplesOnly = db.clips.length > 0 && db.clips.every((c) => c.name.indexOf("[EXAMPLE]") === 0);

  let html = "";
  if (examplesOnly) html += `<div class="demo-banner"><strong>EXAMPLE QUEUE</strong><span>These three clips demonstrate ranking and performance. Delete or rename them as you add real footage.</span></div>`;
  html += pageIntro("Tonight's cut",
    lead ? "One reel is already calling." : "The queue is clear.",
    lead ? `${backlog.length} unposted ${examplesOnly ? "example " : ""}clip${backlog.length === 1 ? "" : "s"} waiting behind the booth.` : "Add a clip after your next show.");
  if (lead) {
    const t = totalScore(lead);
    const rank = ordered.indexOf(lead) + 1;
    html += `<button class="hero-next" data-open="${lead.id}" aria-label="Open next clip ${esc(lead.name)}">
      <div class="hero-stripe"><span>POST NEXT</span><strong>#${rank}</strong></div>
      <div class="hero-body"><div><p>${esc(lead.event_name)}</p><h2>${esc(lead.name)}</h2></div>${scoreDial(t)}</div>
      ${scoreBars(lead, true)}
      <span class="open-cue">Open clip <b>↗</b></span></button>`;
  } else {
    html += `<button class="empty-hero" data-goto="add"><span>+</span><strong>Add the first clip</strong></button>`;
  }
  html += `<div class="stats-grid">
    <article class="stat"><p>Backlog</p><strong>${backlog.length}</strong><span>not posted</span></article>
    <article class="stat"><p>Posted this week</p><strong>${postedThisWeek}</strong><span>since Monday</span></article>
    <article class="stat"><p>Posted avg</p><strong>${postedAvg === null ? "—" : postedAvg.toFixed(1)}</strong><span>out of 50</span></article>
    <article class="stat"><p>Backlog avg</p><strong>${backlogAvg === null ? "—" : backlogAvg.toFixed(1)}</strong><span>scored clips</span></article>
  </div>`;
  html += `<div class="section-heading"><div><p class="kicker">Priority stack</p><h2>Top 3 next up</h2></div><button class="text-button" data-goto="queue">Full queue</button></div>`;
  html += `<div class="next-list">`;
  if (next.length) {
    html += next.map((c, i) => {
      const t = totalScore(c);
      return `<button class="next-row" data-open="${c.id}"><span class="rank-number">0${i + 1}</span><span class="next-copy"><strong>${esc(c.name)}</strong><small>${esc(c.event_name)}</small></span><b class="${scoreTone(t)}">${t === null ? "—" : t}</b></button>`;
    }).join("");
  } else {
    html += `<p class="empty-copy">No clips waiting. The next one you add will land here.</p>`;
  }
  return html + `</div>`;
}

/* ---------- queue ---------- */
function viewQueue() {
  const ordered = orderedClips();
  const firstUnposted = ordered.find((c) => !c.posted_to_ig);
  let html = pageIntro("Posting order", "The queue", "Scores set the order. Arrows lock in your own call.");
  html += `<div class="queue-toolbar"><span>${ordered.length} clip${ordered.length === 1 ? "" : "s"}</span><button class="secondary-button" data-act="reset-order">Reset to auto-rank</button></div>`;
  html += `<div class="queue-stack">` + ordered.map((c, i) => {
    const t = totalScore(c);
    return `<article class="queue-card${firstUnposted && c.id === firstUnposted.id ? " queue-lead" : ""}">
      <div class="queue-rank"><span>#${i + 1}</span><div>
        <button data-move="${c.id}" data-dir="-1" aria-label="Move ${esc(c.name)} up" ${i === 0 ? "disabled" : ""}>↑</button>
        <button data-move="${c.id}" data-dir="1" aria-label="Move ${esc(c.name)} down" ${i === ordered.length - 1 ? "disabled" : ""}>↓</button>
      </div></div>
      <button class="queue-open" data-open="${c.id}">
        <div class="queue-title">${firstUnposted && c.id === firstUnposted.id ? `<span class="post-badge">POST NEXT</span>` : ""}${c.posted_to_ig ? `<span class="posted-badge">POSTED</span>` : ""}<p>${esc(c.event_name)}</p><h2>${esc(c.name)}</h2></div>
        ${scoreDial(t, true)}
      </button>
      ${scoreBars(c, true)}
    </article>`;
  }).join("") + `</div>`;
  if (!ordered.length) html += `<p class="empty-copy">No clips yet. Add one to start the ranking.</p>`;
  return html;
}

/* ---------- add clip ---------- */
function viewAdd() {
  return pageIntro("Fresh footage", "Log a clip", "Name it while the room is still ringing. Score it on the next screen.") + `
  <form class="form-stack intake" id="add-form">
    <label class="field"><span>Clip name <b>*</b></span><input name="name" placeholder="Crowd erupts on the second drop" required></label>
    <label class="field"><span>Show / event <b>*</b></span><input name="event_name" placeholder="Event name" required></label>
    <label class="field"><span>Date shot <b>*</b></span><input type="date" name="date_shot" value="${todayLocal()}" required></label>
    <label class="field"><span>Camera roll reference</span><small>Optional — filename or note only</small><input name="video_ref" placeholder="IMG_4821.MOV"></label>
    <label class="field"><span>Notes</span><textarea name="notes" placeholder="Best moment, edit idea, who appears…" rows="4"></textarea></label>
    <button class="primary-button large" type="submit">Save &amp; score clip</button>
  </form>`;
}

/* ---------- clip detail ---------- */
let draft = null; // working copy while editing a clip
let confirmDeleteClip = false;

function viewDetailShell() {
  const clip = getClip(detailId);
  if (!clip) return `<button class="back-button" data-goto="queue">← Back to queue</button><div class="state-screen"><h1>Clip not found.</h1></div>`;
  draft = JSON.parse(JSON.stringify(clip));
  confirmDeleteClip = false;
  return detailHTML();
}
function draftTotal() { return totalScore(draft); }
function detailHTML() {
  const t = draftTotal();
  const sliders = scoreFields.map((f) =>
    `<label class="slider-row"><span><b>${esc(f.label)}</b><strong data-slider-val="${f.key}">${draft[f.key] === null || draft[f.key] === undefined ? "—" : draft[f.key]}</strong></span>
     <input type="range" min="1" max="10" step="1" value="${draft[f.key] === null || draft[f.key] === undefined ? 5 : draft[f.key]}" data-slider="${f.key}" aria-label="${esc(f.label)}"></label>`
  ).join("");
  const metricInputs = metricFields.map((f) =>
    `<label class="field"><span>${f.label}</span><input type="number" min="1" inputmode="numeric" data-metric="${f.key}" value="${draft[f.key] === null || draft[f.key] === undefined ? "" : draft[f.key]}" placeholder="—"></label>`
  ).join("");
  return `<button class="back-button" data-goto="queue">← Back to queue</button>
  <header class="detail-hero"><div><p>${esc(draft.event_name)}</p><h1>${esc(draft.name)}</h1></div>${scoreDial(t)}</header>
  <form class="detail-form" id="detail-form">
    <fieldset class="form-section"><legend><span>01</span>Clip file</legend>
      <div class="two-col">
        <label class="field"><span>Clip name <b>*</b></span><input data-f="name" value="${esc(draft.name)}" required></label>
        <label class="field"><span>Show / event <b>*</b></span><input data-f="event_name" value="${esc(draft.event_name)}" required></label>
      </div>
      <div class="two-col">
        <label class="field"><span>Date shot</span><input type="date" data-f="date_shot" value="${esc(draft.date_shot)}"></label>
        <label class="field"><span>Video reference</span><input data-f="video_ref" value="${esc(draft.video_ref || "")}" placeholder="Filename or camera roll note"></label>
      </div>
      <label class="field"><span>Notes</span><textarea rows="3" data-f="notes">${esc(draft.notes)}</textarea></label>
    </fieldset>
    <fieldset class="form-section"><legend><span>02</span>Score the moment</legend>
      <div class="score-summary"><div><span>LIVE TOTAL</span><strong><b data-live-total>${t === null ? "—" : t}</b><small>/50</small></strong></div><button type="button" class="text-button" data-act="clear-scores">Clear scores</button></div>
      <div class="sliders">${sliders}</div>
      <label class="field"><span>Scored by</span><select data-f="scored_by">
        <option value="">Choose scorer</option>
        <option value="Aaron"${draft.scored_by === "Aaron" ? " selected" : ""}>Aaron</option>
        <option value="Vesper"${draft.scored_by === "Vesper" ? " selected" : ""}>Vesper</option>
      </select></label>
      <p class="honest-note">Scoring is manual — rate each clip yourself, or have Vesper score it after watching in chat.</p>
    </fieldset>
    <fieldset class="form-section"><legend><span>03</span>Shape the edit</legend>
      <div class="two-col">
        <label class="field"><span>Suggested cut in</span><input data-f="cut_in" value="${esc(draft.cut_in || "")}" placeholder="0:03"></label>
        <label class="field"><span>Suggested cut out</span><input data-f="cut_out" value="${esc(draft.cut_out || "")}" placeholder="0:18"></label>
      </div>
      <label class="field"><span>Caption draft</span><textarea rows="6" data-f="caption" placeholder="Draft the hook and call to action…">${esc(draft.caption)}</textarea></label>
      <label class="field"><span>Hashtags</span><input data-f="hashtags" value="${esc(draft.hashtags)}" placeholder="#nashvilleedm #edm"></label>
    </fieldset>
    <fieldset class="form-section"><legend><span>04</span>Posting checklist</legend>
      <label class="check-row"><input type="checkbox" data-f-check="posted_to_ig"${draft.posted_to_ig ? " checked" : ""}><span><strong>Posted to Instagram</strong><small>Moves this clip out of the backlog</small></span></label>
      <div class="two-col">
        <label class="field"><span>Date posted</span><input type="date" data-f="date_posted" value="${esc(draft.date_posted || "")}" ${draft.posted_to_ig ? "" : "disabled"}></label>
        <label class="field"><span>Instagram post link</span><input type="url" data-f="ig_post_link" value="${esc(draft.ig_post_link || "")}" placeholder="https://…" ${draft.posted_to_ig ? "" : "disabled"}></label>
      </div>
    </fieldset>
    <fieldset class="form-section"><legend><span>05</span>Performance</legend>
      <div class="metric-grid">${metricInputs}</div>
      <p class="field-hint">Blank or zero stays unentered, so missing metrics never count as performance.</p>
    </fieldset>
    <div class="save-dock"><span data-save-note>All fields save together</span><button class="primary-button" type="submit">Save clip</button></div>
  </form>
  <section class="danger-zone" aria-label="Delete clip" id="danger-zone">${deleteZoneHTML()}</section>`;
}
function deleteZoneHTML() {
  if (!confirmDeleteClip) return `<div><h2>Remove clip</h2><p>Permanently remove this clip and its saved details.</p></div><button class="delete-button" type="button" data-act="ask-delete-clip">Delete</button>`;
  return `<div class="delete-confirm" role="alert"><div><h2>Are you sure?</h2><p>This cannot be undone.</p></div>
    <div class="delete-actions"><button class="secondary-button" type="button" data-act="cancel-delete-clip">Cancel</button><button class="delete-button solid" type="button" data-act="do-delete-clip">Yes, delete clip</button></div></div>`;
}
function bindDetail(root) {
  $$("[data-f]", root).forEach((el) => {
    el.addEventListener("input", () => {
      const k = el.getAttribute("data-f");
      let v = el.value;
      if ((k === "video_ref" || k === "cut_in" || k === "cut_out" || k === "date_posted" || k === "ig_post_link") && v === "") v = null;
      if (k === "scored_by" && v === "") v = null;
      draft[k] = v;
    });
  });
  $$("[data-slider]", root).forEach((el) => {
    el.addEventListener("input", () => {
      const k = el.getAttribute("data-slider");
      draft[k] = Number(el.value);
      const lbl = $(`[data-slider-val="${k}"]`, root);
      if (lbl) lbl.textContent = el.value;
      const t = draftTotal();
      const live = $("[data-live-total]", root);
      if (live) live.textContent = t === null ? "—" : t;
    });
  });
  $$("[data-metric]", root).forEach((el) => {
    el.addEventListener("input", () => {
      const k = el.getAttribute("data-metric");
      const v = el.value;
      draft[k] = (v === "" || Number(v) <= 0) ? null : Math.trunc(Number(v));
    });
  });
  const postedBox = $("[data-f-check]", root);
  if (postedBox) postedBox.addEventListener("change", () => {
    draft.posted_to_ig = postedBox.checked;
    $$('[data-f="date_posted"], [data-f="ig_post_link"]', root).forEach((i) => { i.disabled = !postedBox.checked; });
  });
  const clearBtn = $("[data-act='clear-scores']", root);
  if (clearBtn) clearBtn.addEventListener("click", () => {
    scoreFields.forEach((f) => { draft[f.key] = null; });
    render(); // re-render to reset sliders + total
  });
  const form = $("#detail-form", root);
  if (form) form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.event_name.trim()) return;
    const i = db.clips.findIndex((c) => c.id === draft.id);
    if (i >= 0) db.clips[i] = JSON.parse(JSON.stringify(draft));
    save();
    const note = $("[data-save-note]", root);
    if (note) note.textContent = "Changes saved";
    setTimeout(() => { const n2 = $("[data-save-note]"); if (n2) n2.textContent = "All fields save together"; }, 1800);
  });
  const dz = $("#danger-zone", root);
  if (dz) dz.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    if (act === "ask-delete-clip") { confirmDeleteClip = true; dz.innerHTML = deleteZoneHTML(); }
    else if (act === "cancel-delete-clip") { confirmDeleteClip = false; dz.innerHTML = deleteZoneHTML(); }
    else if (act === "do-delete-clip") {
      db.clips = db.clips.filter((c) => c.id !== draft.id);
      db.queueOrder = db.queueOrder.filter((id) => id !== draft.id);
      save();
      navigate("queue");
    }
  });
}

/* ---------- production ---------- */
const conceptDrafts = new Map(); // id -> working copy
let confirmDeleteConcept = null;

function viewProduction() {
  let html = pageIntro("Auto-edit desk", "In production", "Vesper pitches the hook and cut. You choose the direction, review the finished reel, then approve the post.");
  html += `<div class="handoff-strip"><strong>Footage handoff</strong><span>Attach the original show videos in your chat with Vesper. Log the source clip here so concepts, review, approval, and the final post stay connected.</span></div>`;
  html += composerHTML();
  html += `<div class="limits-note"><strong>Production scope</strong><p>Vesper does the video work in chat and tracks it here: clean ffmpeg-level cuts, overlays, captions, punch-ins, audio leveling, and compression-safe exports—not After Effects-style motion graphics.</p></div>`;
  const groups = [
    { key: "uploaded", kicker: "Source clips received", title: "Awaiting concept proposals", statuses: ["uploaded"], empty: "No received clips are waiting for a concept proposal." },
    { key: "ideas", kicker: "Pick the direction", title: "Awaiting Aaron's choice", statuses: ["concept"], empty: "No concepts waiting for a choice." },
    { key: "working", kicker: "On the timeline", title: "Edits in progress", statuses: ["chosen", "editing"], empty: "No chosen edits in progress." },
    { key: "review", kicker: "Final eyes", title: "Awaiting review", statuses: ["ready_for_review"], empty: "No finished edits waiting for review." },
    { key: "approved", kicker: "Greenlit", title: "Approved, ready to post", statuses: ["approved"], empty: "No approved edits waiting to post." },
  ];
  groups.forEach((g) => {
    const items = db.concepts.filter((c) => g.statuses.includes(c.status));
    html += `<section class="production-section"><div class="section-heading"><div><p class="kicker">${g.kicker}</p><h2>${g.title}</h2></div><span>${items.length}</span></div>`;
    html += `<div class="concept-stack">` + items.map(conceptCardHTML).join("") + `</div>`;
    if (!items.length) html += `<p class="production-empty">${g.empty}</p>`;
    html += `</section>`;
  });
  return html;
}
function composerHTML() {
  if (!composerOpen) return `<button class="production-add" data-act="open-composer"><span>+</span><strong>Log a received clip</strong><small>Start at Uploaded, awaiting a concept proposal</small></button>`;
  const opts = db.clips.map((c) => `<option value="${c.id}">${esc(c.name)} — ${esc(c.event_name)}</option>`).join("");
  return `<form class="concept-composer" id="composer-form">
    <div class="composer-heading"><div><p class="kicker">Production intake</p><h2>Start the workflow</h2></div><button type="button" class="text-button" data-act="close-composer">Close</button></div>
    ${db.clips.length ? `
    <label class="field"><span>Source clip <b>*</b></span><select name="clip_id">${opts}</select></label>
    <label class="field"><span>Working name <b>*</b></span><input name="name" placeholder="Received show clip" required></label>
    <p class="composer-note">This starts at Uploaded. Add the hook, cut plan, and caption angle from its production card before proposing the concept.</p>
    <button class="primary-button" type="submit">Add to awaiting proposals</button>` :
    `<div class="production-empty">Add a source clip first, then return here to start production.</div>`}
  </form>`;
}
function conceptDraft(c) {
  if (!conceptDrafts.has(c.id)) conceptDrafts.set(c.id, JSON.parse(JSON.stringify(c)));
  return conceptDrafts.get(c.id);
}
function conceptCardHTML(c) {
  const d = conceptDraft(c);
  const checked = checklistFields.filter((f) => d[f.key]).length;
  const proposalComplete = d.hook_description.trim() && d.cut_plan.trim() && d.caption_angle.trim();
  let nextAction = null;
  if (d.status === "uploaded") nextAction = { label: proposalComplete ? "Propose this concept" : "Add hook, cut plan & caption angle", next: "concept", gated: !proposalComplete };
  else if (d.status === "concept") nextAction = { label: "Choose this concept", next: "chosen" };
  else if (d.status === "chosen") nextAction = { label: "Start editing", next: "editing" };
  else if (d.status === "editing") nextAction = { label: "Mark ready for review", next: "ready_for_review" };
  const checks = checklistFields.map((f) =>
    `<label class="production-check"><input type="checkbox" data-c-check="${c.id}" data-k="${f.key}"${d[f.key] ? " checked" : ""}><span><strong>${esc(f.label)}</strong><small>${esc(f.detail)}</small></span></label>`
  ).join("");
  const openDetails = d.status === "uploaded" || d.status === "ready_for_review" || d.status === "approved";
  return `<article class="concept-card status-${d.status}" data-concept="${c.id}">
    <header class="concept-head"><div><span class="status-chip">${statusLabels[d.status]}</span><p>${esc(d.event_name)} · ${esc(d.clip_name)}</p><h3>${esc(d.name)}</h3></div><strong>${checked}<small>/12</small></strong></header>
    <div class="concept-pitch"><span>HOOK</span><p>${esc(d.hook_description) || "Hook description not added yet."}</p></div>
    <dl class="concept-brief"><div><dt>Cut plan</dt><dd>${esc(d.cut_plan) || "Add timestamps after reviewing the source."}</dd></div><div><dt>Caption angle</dt><dd>${esc(d.caption_angle) || "Add the story angle for this concept."}</dd></div></dl>
    ${(d.status === "ready_for_review" || d.status === "approved") ? `<div class="finished-draft"><p class="kicker">Publishing package</p><strong>${esc(d.caption_draft) || "Caption draft still needed."}</strong><span>${esc(d.hashtags_draft) || "Hashtags still needed."}</span></div>` : ""}
    <details class="production-details"${openDetails ? " open" : ""}>
      <summary>Edit plan &amp; checklist <span>${checked}/12 ready</span></summary>
      <div class="concept-fields">
        <label class="field"><span>Concept name</span><input data-c-f="${c.id}" data-k="name" value="${esc(d.name)}"></label>
        <label class="field"><span>Hook description</span><textarea rows="2" data-c-f="${c.id}" data-k="hook_description">${esc(d.hook_description)}</textarea></label>
        <label class="field"><span>Cut plan</span><textarea rows="3" data-c-f="${c.id}" data-k="cut_plan">${esc(d.cut_plan)}</textarea></label>
        <label class="field"><span>Caption angle</span><input data-c-f="${c.id}" data-k="caption_angle" value="${esc(d.caption_angle)}"></label>
        <div class="checklist-grid">${checks}</div>
        <label class="field"><span>Caption draft</span><small>Lead with the hook on line one.</small><textarea rows="5" data-c-f="${c.id}" data-k="caption_draft" placeholder="Hook-first caption…">${esc(d.caption_draft)}</textarea></label>
        <label class="field"><span>Hashtag draft</span><small>Keep Nashville EDM / EDM and Nashville location tags relevant.</small><input data-c-f="${c.id}" data-k="hashtags_draft" value="${esc(d.hashtags_draft)}" placeholder="#nashvilleedm #edm #nashville"></label>
        <div class="detail-actions"><button class="secondary-button" type="button" data-act="save-concept" data-id="${c.id}">Save details</button>${confirmDeleteConcept === c.id ? `<span class="inline-confirm">Delete it? <button type="button" data-act="cancel-del-concept" data-id="${c.id}">Cancel</button><button type="button" data-act="do-del-concept" data-id="${c.id}">Yes, delete</button></span>` : `<button class="delete-link" type="button" data-act="ask-del-concept" data-id="${c.id}">Delete concept</button>`}</div>
      </div>
    </details>
    ${nextAction ? `<button class="stage-button" data-act="stage" data-id="${c.id}" data-next="${nextAction.next}"${nextAction.gated ? " disabled" : ""}>${esc(nextAction.label)} →</button>` : ""}
    ${d.status === "ready_for_review" ? `<div class="review-actions"><button class="secondary-button" data-act="stage" data-id="${c.id}" data-next="editing">Request revisions</button><button class="primary-button" data-act="stage" data-id="${c.id}" data-next="approved">Approve finished edit</button></div>` : ""}
    ${d.status === "approved" ? `<div class="post-gate"><strong>Nothing is published to Instagram without Aaron's explicit approval of the finished edit.</strong>
      <label class="field"><span>Instagram post link <b>*</b></span><input type="url" data-c-f="${c.id}" data-k="ig_post_link" value="${esc(d.ig_post_link || "")}" placeholder="https://www.instagram.com/…"></label>
      <div class="review-actions"><button class="secondary-button" data-act="stage" data-id="${c.id}" data-next="editing">Reopen edit</button><button class="post-button" data-act="mark-posted" data-id="${c.id}"${d.ig_post_link ? "" : " disabled"}>Mark posted</button></div></div>` : ""}
  </article>`;
}
function persistConcept(id) {
  const d = conceptDrafts.get(id);
  if (!d) return;
  const i = db.concepts.findIndex((c) => c.id === id);
  if (i >= 0) db.concepts[i] = JSON.parse(JSON.stringify(d));
  save();
}
function bindProduction(root) {
  // text fields write through to drafts
  $$("[data-c-f]", root).forEach((el) => {
    el.addEventListener("input", () => {
      const id = Number(el.getAttribute("data-c-f"));
      const k = el.getAttribute("data-k");
      const c = db.concepts.find((x) => x.id === id);
      const d = conceptDraft(c);
      let v = el.value;
      if (k === "ig_post_link" && v === "") v = null;
      d[k] = v;
      // enable/disable the Mark posted button live
      if (k === "ig_post_link") {
        const btn = $(`[data-act="mark-posted"][data-id="${id}"]`, root);
        if (btn) btn.disabled = !v;
      }
    });
  });
  $$("[data-c-check]", root).forEach((el) => {
    el.addEventListener("change", () => {
      const id = Number(el.getAttribute("data-c-check"));
      const k = el.getAttribute("data-k");
      const c = db.concepts.find((x) => x.id === id);
      conceptDraft(c)[k] = el.checked;
    });
  });
  const composer = $("#composer-form", root);
  if (composer) composer.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(composer);
    const name = String(fd.get("name") || "").trim();
    if (!name) return;
    const clip = getClip(Number(fd.get("clip_id")));
    const nc = blankConcept();
    nc.id = db.conceptSeq++;
    nc.clip_id = clip ? clip.id : 0;
    nc.clip_name = clip ? clip.name : "";
    nc.event_name = clip ? clip.event_name : "";
    nc.name = name;
    db.concepts.push(nc);
    save();
    composerOpen = false;
    render();
  });
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn || btn.closest("#composer-form")) return;
    const act = btn.getAttribute("data-act");
    const id = btn.getAttribute("data-id") ? Number(btn.getAttribute("data-id")) : null;
    if (act === "open-composer") { composerOpen = true; render(); }
    else if (act === "close-composer") { composerOpen = false; render(); }
    else if (act === "save-concept" && id !== null) {
      persistConcept(id);
      btn.textContent = "Saved";
      setTimeout(() => render(), 600);
    }
    else if (act === "stage" && id !== null) {
      persistConcept(id);
      const c = db.concepts.find((x) => x.id === id);
      const d = conceptDraft(c);
      d.status = btn.getAttribute("data-next");
      persistConcept(id);
      conceptDrafts.delete(id);
      render();
    }
    else if (act === "mark-posted" && id !== null) {
      persistConcept(id);
      const c = db.concepts.find((x) => x.id === id);
      const d = conceptDraft(c);
      if (!d.ig_post_link) return;
      d.status = "posted";
      persistConcept(id);
      conceptDrafts.delete(id);
      render();
    }
    else if (act === "ask-del-concept" && id !== null) { confirmDeleteConcept = id; render(); }
    else if (act === "cancel-del-concept") { confirmDeleteConcept = null; render(); }
    else if (act === "do-del-concept" && id !== null) {
      db.concepts = db.concepts.filter((x) => x.id !== id);
      conceptDrafts.delete(id);
      confirmDeleteConcept = null;
      save(); render();
    }
  });
}

/* ---------- performance ---------- */
function viewPerformance() {
  const posted = orderedClips().filter((c) => c.posted_to_ig);
  const tiers = [
    { label: "40+", values: posted.filter((c) => (totalScore(c) === null ? -1 : totalScore(c)) >= 40).map((c) => c.views) },
    { label: "30–39", values: posted.filter((c) => { const t = totalScore(c); return t !== null && t >= 30 && t < 40; }).map((c) => c.views) },
    { label: "Below 30", values: posted.filter((c) => { const t = totalScore(c); return t !== null && t < 30; }).map((c) => c.views) },
  ].map((t) => ({ label: t.label, average: average(t.values.filter((v) => v !== null && v !== undefined)) }));
  const max = Math.max(1, ...tiers.map((t) => t.average || 0));
  let html = pageIntro("What hit", "Performance", "Compare the score you gave a clip with the audience it earned.");
  html += `<div class="correlation-panel"><div class="section-heading"><div><p class="kicker">Signal check</p><h2>Average views by score tier</h2></div></div>
    <div class="tier-chart">` + tiers.map((t) =>
      `<div class="tier-row"><span>${t.label}</span><div><i style="width:${t.average === null ? "0%" : Math.max(4, (t.average / max) * 100) + "%"}"></i></div><strong>${fmtNumber(t.average)}</strong></div>`
    ).join("") + `</div><p class="chart-note">Only reels with entered views are included. More posts make this signal stronger.</p></div>`;
  html += `<div class="section-heading"><div><p class="kicker">Posted reels</p><h2>Results ledger</h2></div><span>${posted.length} total</span></div>`;
  html += `<div class="performance-desktop"><table><thead><tr><th>Clip</th><th>Score</th><th>Views</th><th>Likes</th><th>Comments</th><th>Shares</th><th>Saves</th></tr></thead><tbody>` +
    posted.map((c) => { const t = totalScore(c); return `<tr data-open="${c.id}"><td><strong>${esc(c.name)}</strong><small>${esc(c.event_name)}</small></td><td>${t === null ? "—" : t}</td><td>${fmtNumber(c.views)}</td><td>${fmtNumber(c.likes)}</td><td>${fmtNumber(c.comments)}</td><td>${fmtNumber(c.shares)}</td><td>${fmtNumber(c.saves)}</td></tr>`; }).join("") +
    `</tbody></table></div>`;
  html += `<div class="performance-mobile">` + posted.map((c) => {
    const t = totalScore(c);
    return `<button class="performance-card" data-open="${c.id}"><div><span class="${scoreTone(t)}">${t === null ? "—" : t}</span><h3>${esc(c.name)}</h3></div>
      <dl>` + metricFields.map((f) => `<div><dt>${f.label}</dt><dd>${fmtNumber(c[f.key])}</dd></div>`).join("") + `</dl></button>`;
  }).join("") + `</div>`;
  if (!posted.length) html += `<p class="empty-copy">Mark a clip as posted to start learning from its results.</p>`;
  return html;
}

/* ---------- global bind + init ---------- */
function bind(root) {
  $$("#nav [data-nav]").forEach((b) => b.addEventListener("click", () => navigate(b.getAttribute("data-nav"))));
  $$("[data-open]", root).forEach((el) => el.addEventListener("click", (e) => {
    if (e.target.closest("[data-move]")) return;
    openDetail(Number(el.getAttribute("data-open")));
  }));
  $$("[data-goto]", root).forEach((el) => el.addEventListener("click", () => navigate(el.getAttribute("data-goto"))));
  if (view === "queue") {
    $$("[data-move]", root).forEach((b) => b.addEventListener("click", () => {
      const id = Number(b.getAttribute("data-move"));
      const dir = Number(b.getAttribute("data-dir"));
      const ids = orderedClips().map((c) => c.id);
      const i = ids.indexOf(id), j = i + dir;
      if (i < 0 || j < 0 || j >= ids.length) return;
      const tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp;
      db.queueOrder = ids;
      save(); render();
    }));
    const reset = $("[data-act='reset-order']", root);
    if (reset) reset.addEventListener("click", () => { db.queueOrder = autoOrder(); save(); render(); });
  }
  if (view === "add") {
    const form = $("#add-form", root);
    if (form) form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = String(fd.get("name") || "").trim();
      const eventName = String(fd.get("event_name") || "").trim();
      if (!name || !eventName) return;
      const nc = blankClip();
      nc.id = db.clipSeq++;
      nc.name = name;
      nc.event_name = eventName;
      nc.date_shot = String(fd.get("date_shot") || todayLocal());
      const vr = String(fd.get("video_ref") || "").trim();
      nc.video_ref = vr || null;
      nc.notes = String(fd.get("notes") || "");
      db.clips.push(nc);
      db.queueOrder.push(nc.id);
      save();
      openDetail(nc.id);
    });
  }
  if (view === "detail") bindDetail(root);
  if (view === "production") bindProduction(root);
}

(function deepLink() {
  try {
    const p = new URLSearchParams(location.search);
    const v = p.get("view");
    if (v) view = v;
    const id = p.get("id");
    if (id) detailId = Number(id);
  } catch (e) { /* ignore */ }
})();

load();
render();
