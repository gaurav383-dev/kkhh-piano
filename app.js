// Kuch Kuch Hota Hai piano page: Listen mode (play-along) and Teacher mode (mic listens, corrects, repeats).
// Reviewed by Codex 2026-11-23; fixes for its findings are tagged [R#].
(function () {
const { LINES, ORDER, buildAbc, midiName } = window.SONG;
const $ = id => document.getElementById(id);
const msgEl = $("msg"), subEl = $("sub"), starsEl = $("stars");
function say(text, kind, sub) { msgEl.textContent = text; msgEl.className = "msg" + (kind ? " " + kind : ""); if (sub !== undefined) subEl.textContent = sub; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- sheet ----------
const tokenOffset = []; { let n = 0; LINES.forEach(l => { tokenOffset.push(n); n += l.tokens.length; }); }
const totalTokens = LINES.reduce((s, l) => s + l.tokens.length, 0);
let noteEls = [];
function render() {
  if (!window.ABCJS) { $("sheet").innerHTML = "<p style='padding:12px'>The music library did not load. Check the internet connection and reload.</p>"; return; }
  const w = $("paper").clientWidth - 24;
  const scale = w < 560 ? 0.85 : w < 820 ? 1.0 : 1.15;
  ABCJS.renderAbc("sheet", buildAbc(), { add_classes: true, staffwidth: Math.max(520, w / scale - 10), scale, paddingleft: 4, paddingright: 4, foregroundColor: "#111" });
  noteEls = Array.from($("sheet").querySelectorAll(".abcjs-note, .abcjs-rest"));
  if (noteEls.length !== totalTokens) console.warn("note element count", noteEls.length, "expected", totalTokens);
}
render();
const marks = new Map(); // element index -> class (teacher marks)
let playingIdx = [];      // element indexes currently highlighted by playback [R14]
let rT; window.addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(() => { render(); reapplyMarks(); }, 250); });
function idxFor(li, press) { return press.tokenIdx.map(j => tokenOffset[li] + j); }
function mark(li, press, cls) {
  idxFor(li, press).forEach(k => { const el = noteEls[k];
    if (el) ["now", "ok", "oops", "playing"].forEach(c => el.classList.remove(c));
    if (cls) { el && el.classList.add(cls); marks.set(k, cls); } else marks.delete(k); });
}
function setPlaying(ks) { playingIdx.forEach(k => noteEls[k] && noteEls[k].classList.remove("playing")); playingIdx = ks; ks.forEach(k => noteEls[k] && noteEls[k].classList.add("playing")); }
function clearAllMarks() { marks.clear(); playingIdx = []; noteEls.forEach(el => el.classList.remove("now", "ok", "oops", "playing")); }
function reapplyMarks() { marks.forEach((cls, k) => noteEls[k] && noteEls[k].classList.add(cls)); playingIdx.forEach(k => noteEls[k] && noteEls[k].classList.add("playing")); }
function scrollToLine(li) {
  const p = LINES[li].presses.find(p => p.pitch); if (!p) return;
  const el = noteEls[idxFor(li, p)[0]]; if (!el) return;
  const r = el.getBoundingClientRect(); const deskH = document.querySelector(".desk").offsetHeight;
  if (r.top < 70 || r.bottom > window.innerHeight - deskH - 40)
    window.scrollTo({ top: window.scrollY + r.top - 90, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

// ---------- keyboard ----------
const kbd = $("kbd");
const whites = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77];
const wl = { 60: "C", 62: "D", 64: "E", 65: "F", 67: "G", 69: "A", 71: "B", 72: "C+", 74: "D+", 76: "E+", 77: "F+" };
const blacks = { 61: 0, 63: 1, 66: 3, 68: 4, 70: 5, 73: 7, 75: 8 };
const used = new Set(Object.values(window.SONG.MIDI));
const keyEl = {}; const ww = 100 / whites.length;
whites.forEach((m, i) => { const k = document.createElement("div"); k.className = "wk" + (used.has(m) ? " used" : "");
  k.style.left = (i * ww) + "%"; k.style.width = ww + "%"; k.textContent = wl[m];
  if (m === 60) { const s = document.createElement("span"); s.className = "mid"; s.textContent = "middle C"; k.appendChild(s); }
  kbd.appendChild(k); keyEl[m] = k; });
Object.entries(blacks).forEach(([m, i]) => { const k = document.createElement("div"); k.className = "bk" + (used.has(+m) ? " used" : "");
  k.style.left = ((i + 1) * ww - ww * 0.3) + "%"; k.style.width = (ww * 0.6) + "%"; if (+m === 66) k.textContent = "F#";
  kbd.appendChild(k); keyEl[m] = k; });
function keyOn(m, cls) { Object.values(keyEl).forEach(k => k.classList.remove("now", "on", "ok", "oops")); if (m && keyEl[m]) keyEl[m].classList.add(cls); }
function keyFor(m) { if (keyEl[m]) return m; const pc = ((m % 12) + 12) % 12; return [60,61,62,63,64,65,66,67,68,69,70,71].find(x => x % 12 === pc); }

// ---------- sound ----------
let ctx = null;
function audioCtx() { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); return ctx; }
// [R2] Call from a tap. Resolves true only when the audio clock is actually running.
async function ensureAudio() {
  const c = audioCtx();
  if (c.state !== "running") { try { await Promise.race([c.resume(), sleep(1500)]); } catch (e) {} }
  return c.state === "running";
}
let voices = [];
function tone(midi, start, dur) {
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const g = ctx.createGain(); g.connect(ctx.destination);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(0.3, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(0.18, dur * 0.95));
  [["triangle", 1, 1], ["sine", 2, 0.18]].forEach(([type, mult, vol]) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * mult;
    const og = ctx.createGain(); og.gain.value = vol; o.connect(og); og.connect(g);
    o.start(start); o.stop(start + dur + 0.05); voices.push(o); });
}
let timers = [], playResolve = null;
// [R3] Stopping playback resolves the waiting caller with false instead of leaving it hanging.
function stopSound() {
  timers.forEach(clearTimeout); timers = [];
  voices.forEach(v => { try { v.stop(); } catch (e) {} }); voices = [];
  if (playResolve) { const r = playResolve; playResolve = null; r(false); }
  setPlaying([]);
}
function playLines(lineIdxs, bpm) {
  stopSound();
  if (!ctx || ctx.state !== "running") return Promise.resolve(false); // [R2] never pretend a silent demo happened
  const eighth = 30 / bpm; const lead = 0.15; const t0 = ctx.currentTime + lead;
  let t = 0;
  lineIdxs.forEach(li => {
    const line = LINES[li];
    timers.push(setTimeout(() => scrollToLine(li), (lead + t) * 1000));
    line.presses.forEach(p => {
      const at = t, dur = p.len * eighth;
      if (p.pitch) tone(p.pitch, t0 + at, dur);
      timers.push(setTimeout(() => {
        if (ctx.state !== "running") { stopSound(); return; } // [R2] audio got interrupted: abandon
        setPlaying(idxFor(li, p));
        if (p.pitch) { keyOn(p.pitch, "on"); if (mode === "listen") say(p.name + (p.word && !"_*".includes(p.word) ? "  ·  " + p.word : ""), "", line.say); }
        else keyOn(null);
      }, (lead + at) * 1000));
      t += dur;
    });
  });
  return new Promise(res => {
    playResolve = res;
    timers.push(setTimeout(() => { setPlaying([]); keyOn(null); if (playResolve === res) { playResolve = null; res(true); } }, (lead + t) * 1000 + 120));
  });
}

// ---------- Listen mode ----------
let mode = "listen";
const tempo = $("tempo");
tempo.addEventListener("input", () => { $("bpmv").textContent = tempo.value; });
$("play").addEventListener("click", async () => {
  if (!(await ensureAudio())) { say("No sound yet", "bad", "Tap Play again. If it stays silent, close other apps using sound and reload."); return; }
  const done = await playLines(ORDER[$("part").value], +tempo.value);
  if (done && mode === "listen") say("Well played! 🎹", "good", "");
});
$("stop").addEventListener("click", () => { stopSound(); clearAllMarks(); keyOn(null); say("Press Play to listen", "", ""); });

// ---------- Tabs ----------
function setMode(m) {
  mode = m;
  $("tabListen").setAttribute("aria-selected", m === "listen"); $("tabTeach").setAttribute("aria-selected", m === "teach");
  $("listenControls").hidden = m !== "listen"; $("teachControls").hidden = m !== "teach";
  stopLesson(true); stopSound(); clearAllMarks(); keyOn(null);
  if (m === "teach") say("Press Start lesson", "", "Put the iPad on the piano. It will listen and help.");
  else say("Press Play to listen", "", "");
}
$("tabListen").addEventListener("click", () => setMode("listen"));
$("tabTeach").addEventListener("click", () => setMode("teach"));

// ---------- Voice ----------
// [R4][R11] Off by default: on some iPadOS versions speech can mute the microphone.
function unlockSpeech() { try { if (window.speechSynthesis) speechSynthesis.speak(new SpeechSynthesisUtterance(" ")); } catch (e) {} }
$("voice").addEventListener("change", () => { if ($("voice").checked) unlockSpeech(); });
function speak(text) {
  return new Promise(res => {
    if (!$("voice").checked || !window.speechSynthesis) return res();
    let settled = false, wd = null;
    const done = () => { if (settled) return; settled = true; clearTimeout(wd); res(); };
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.rate = 1.0; u.pitch = 1.1;
      u.onend = done; u.onerror = done;
      wd = setTimeout(() => { try { speechSynthesis.cancel(); } catch (e) {} done(); }, 600 + text.length * 90);
      speechSynthesis.speak(u);
    } catch (e) { done(); }
  });
}

// ---------- Mic + pitch detection ----------
let micStream = null, analyser = null, buf = null, micTimer = null;
let noiseFloor = 0.004, deafUntil = 0, needAttack = true;
const DEAF_TAIL = 350; // ms ignored after the iPad itself makes a sound
function deafFor(ms) { deafUntil = Math.max(deafUntil, performance.now() + ms); }

function yin(x, sr) {
  // YIN for 180..800 Hz (song range D4–E5). The 800 Hz ceiling avoids reading a strong 3rd harmonic as the note. [R12]
  const minTau = Math.floor(sr / 800), maxTau = Math.ceil(sr / 180);
  const W = Math.min(x.length - maxTau, 1024);
  if (W <= 0) return null;
  const d = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) { let s = 0; for (let i = 0; i < W; i++) { const v = x[i] - x[i + tau]; s += v * v; } d[tau] = s; }
  let run = 0; const cm = new Float32Array(maxTau + 1); cm[0] = 1;
  for (let tau = 1; tau <= maxTau; tau++) { run += d[tau]; cm[tau] = run ? d[tau] * tau / run : 1; }
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) { if (cm[t] < 0.15) { while (t + 1 <= maxTau && cm[t + 1] < cm[t]) t++; tau = t; break; } }
  if (tau < 0) return null;
  const a = cm[tau - 1] ?? cm[tau], b = cm[tau], c = cm[tau + 1] ?? cm[tau];
  const shift = (a - 2 * b + c) ? 0.5 * (a - c) / (a - 2 * b + c) : 0;
  return { freq: sr / (tau + shift), conf: 1 - b };
}

let lastRms = [], lastFast = [], pending = null, lastOnset = 0, stable = { midi: null, n: 0, fired: false }, lastNoteMidi = null, idleRms = [];
function resetDetector() { lastRms = []; lastFast = []; pending = null; stable = { midi: null, n: 0, fired: false }; lastNoteMidi = null; needAttack = true; }
function micTick() {
  if (!analyser) return;
  analyser.getFloatTimeDomainData(buf);
  let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  const rms = Math.sqrt(s / buf.length);
  // short window (last ~10 ms) catches a re-struck key over a ringing one [R8]
  let f = 0; const FW = 480; for (let i = buf.length - FW; i < buf.length; i++) f += buf[i] * buf[i];
  const fast = Math.sqrt(f / FW);
  $("meter").style.width = Math.min(100, rms / 0.08 * 100) + "%";
  const now = performance.now();
  const prevMin = lastRms.length ? Math.min(...lastRms) : rms;
  const prevFastMin = lastFast.length ? Math.min(...lastFast) : fast;
  lastRms.push(rms); if (lastRms.length > 6) lastRms.shift();
  lastFast.push(fast); if (lastFast.length > 3) lastFast.shift();
  const loud = rms > Math.max(noiseFloor * 3, 0.006);
  const det = loud ? yin(buf, ctx.sampleRate) : null;
  const midi = det && det.conf > 0.8 ? Math.round(69 + 12 * Math.log2(det.freq / 440)) : null;
  $("heard").textContent = midi ? midiName(midi) : "–";
  if (now < deafUntil) { pending = null; stable = { midi: null, n: 0, fired: false }; lastNoteMidi = null; needAttack = true; return; }
  // slowly track the room's quiet level [R10]
  if (!loud && !pending) { idleRms.push(rms); if (idleRms.length > 100) idleRms.shift(); if (idleRms.length === 100) { const q = idleRms.slice().sort((a, b) => a - b)[25]; noiseFloor = Math.min(0.01, Math.max(0.0015, 0.9 * noiseFloor + 0.1 * q)); } }
  const attack = loud && now - lastOnset > 120 && (rms > prevMin * 1.8 || fast > prevFastMin * 2.2);
  if (attack && !pending) { pending = { t: now, votes: [] }; lastOnset = now; needAttack = false; }
  // legato pitch change (only after a real attack has happened since the iPad last made sound) [R5]
  if (midi !== null) { if (stable.midi === midi) stable.n++; else stable = { midi, n: 1, fired: false }; } else stable = { midi: null, n: 0, fired: false };
  if (!pending && !needAttack && stable.n >= 3 && !stable.fired && stable.midi !== lastNoteMidi && now - lastOnset > 120) {
    stable.fired = true; pending = { t: now, votes: [stable.midi, stable.midi, stable.midi] }; lastOnset = now;
  }
  if (pending) {
    if (midi !== null && now - pending.t > 15) pending.votes.push(midi); // fresh frames only
    if (pending.votes.length >= 5 || now - pending.t > 240) {
      const v = pending.votes; pending = null;
      if (v.length >= 2) {
        const counts = {}; v.forEach(m => counts[m] = (counts[m] || 0) + 1);
        const ranked = Object.keys(counts).map(Number).sort((a, b) => counts[b] - counts[a] || b - a);
        lastNoteMidi = ranked[0];
        onHeard({ best: ranked[0], counts, total: v.length });
      }
    }
  }
  if (!loud) lastNoteMidi = null;
}

const micSession = { starting: false, cancelled: false };
async function startMic() {
  if (micStream) return "ok";
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return "nomic";
  micSession.starting = true; micSession.cancelled = false;
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
  catch (e) { micSession.starting = false; return "denied"; }
  if (micSession.cancelled) { stream.getTracks().forEach(t => t.stop()); micSession.starting = false; return "cancelled"; } // [R1]
  micStream = stream;
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser(); an.fftSize = 2048; src.connect(an);
  const b = new Float32Array(an.fftSize);
  stream.getAudioTracks().forEach(t => { t.onmute = () => micLost(); t.onended = () => micLost(); }); // [R4]
  // measure the room (~0.8 s), using the quieter frames [R10]
  const samples = [];
  for (let i = 0; i < 16 && !micSession.cancelled; i++) {
    an.getFloatTimeDomainData(b); let s = 0; for (let j = 0; j < b.length; j++) s += b[j] * b[j];
    samples.push(Math.sqrt(s / b.length)); await sleep(50);
  }
  micSession.starting = false;
  if (micSession.cancelled) { stopMic(); return "cancelled"; }
  samples.sort((a, c) => a - c);
  noiseFloor = Math.min(0.01, Math.max(0.0015, samples[Math.floor(samples.length * 0.25)]));
  analyser = an; buf = b; idleRms = []; resetDetector();
  micTimer = setInterval(micTick, 20);
  $("micRow").hidden = false;
  return "ok";
}
function stopMic() {
  micSession.cancelled = true;
  clearInterval(micTimer); micTimer = null;
  if (micStream) micStream.getTracks().forEach(t => { t.onmute = null; t.onended = null; t.stop(); });
  micStream = null; analyser = null; $("micRow").hidden = true;
}
function micLost() {
  if (!lesson.on) return;
  stopLesson(true);
  say("I can't hear the piano any more", "bad", "The microphone was switched off. Press Start lesson to carry on.");
}

// ---------- Teacher ----------
const lesson = { on: false, session: 0, order: [], pos: 0, idx: 0, grading: false, mistakesInLine: 0, skipped: false, clean: 0, lastOk: null };
const PRAISE = ["Lovely!", "Super!", "Well done!", "Beautiful!", "Yes! Nice one!", "Brilliant!"];
const alive = s => lesson.on && lesson.session === s; // [R3] every await re-checks this
function curLine() { return LINES[lesson.order[lesson.pos]]; }
function curNote() { return curLine().notes[lesson.idx]; }
function showNext() {
  const line = curLine(), n = curNote(); const li = line.index;
  line.notes.forEach((p, i) => { if (i >= lesson.idx) mark(li, p, null); });
  mark(li, n, "now"); keyOn(n.pitch, "now");
}
// Arms grading only once the iPad has gone quiet, and shows "Your turn" at the same moment [R5]
async function armGrading(s, text, sub) {
  lesson.grading = false;
  const wait = Math.max(0, deafUntil - performance.now()) + 30;
  await sleep(wait); if (!alive(s)) return false;
  resetDetector();
  say(text, "", sub); showNext();
  lesson.grading = true;
  return true;
}
async function demoLine(s, slower) {
  lesson.grading = false;
  const bpm = Math.max(55, Math.round(85 * (slower ? 0.8 : 1)));
  const line = curLine();
  say("Listen…", "", line.say);
  line.notes.forEach(p => mark(line.index, p, null));
  const ms = line.presses.reduce((sum, p) => sum + p.len, 0) * (30 / bpm) * 1000;
  deafFor(ms + 600);
  const ok = await playLines([line.index], bpm);
  deafFor(DEAF_TAIL);
  if (!ok && alive(s) && ctx.state !== "running") { stopLesson(true); say("The sound stopped", "bad", "Press Start lesson to carry on."); return false; } // [R2]
  return ok && alive(s);
}
async function beginLine(s) {
  if (!alive(s)) return;
  lesson.idx = 0; lesson.mistakesInLine = 0; lesson.skipped = false; lesson.lastOk = null;
  scrollToLine(curLine().index);
  if ($("demoFirst").checked && !(await demoLine(s, false))) return;
  await armGrading(s, "Your turn!", "Line: " + curLine().say + " · start with " + curNote().name);
}
const samePc = (a, b) => ((a - b) % 12 + 12) % 12 === 0; // same letter in any octave counts
const votesFor = (counts, pitch) => Object.keys(counts).reduce((s, m) => s + (samePc(+m, pitch) ? counts[m] : 0), 0);
async function onHeard(h) {
  if (!lesson.on || !lesson.grading) return;
  const s = lesson.session;
  const line = curLine(), li = line.index;
  let n = curNote();
  const nowMs = performance.now();
  // [R6] right if the expected letter got real support; wrong only with a clear majority for another letter
  let right = votesFor(h.counts, n.pitch) >= 2 || (samePc(h.best, n.pitch));
  if (!right) {
    // the mic sometimes hears one key twice: ignore a repeat of the note just accepted
    if (lesson.lastOk && samePc(h.best, lesson.lastOk.pitch) && nowMs - lesson.lastOk.t < 350) return;
    // [R9] a quick (eighth-note) middle-of-line note may be missed by the mic: accept the following note,
    // but the line no longer counts as perfect
    const after = line.notes[lesson.idx + 1];
    if (lesson.idx > 0 && n.len <= 1 && after && !samePc(after.pitch, n.pitch) && votesFor(h.counts, after.pitch) >= 2) {
      mark(li, n, "ok"); lesson.idx++; lesson.skipped = true; n = curNote(); right = true;
    }
  }
  if (!right) {
    const share = (h.counts[h.best] || 0) / h.total;
    if (h.total < 3 || share <= 0.5) return; // ambiguous: stay on the same note quietly
  }
  if (right) {
    lesson.lastOk = { pitch: n.pitch, t: nowMs };
    mark(li, n, "ok"); keyOn(n.pitch, "ok");
    lesson.idx++;
    if (lesson.idx >= line.notes.length) { lesson.grading = false; return finishLine(s); }
    say(PRAISE[(lesson.idx + lesson.pos) % PRAISE.length].replace("!", "") + " ✓", "good", "Next: " + curNote().name);
    setTimeout(() => { if (alive(s) && lesson.grading && curLine() === line) showNext(); }, 160);
    return;
  }
  // mistake
  lesson.grading = false;
  lesson.mistakesInLine++;
  mark(li, n, "oops"); keyOn(keyFor(h.best), "oops");
  say("Oops! That was " + midiName(h.best) + ".", "bad", "This note is " + n.name + ".");
  if ($("onMistake").value === "note") {
    await speak("Oops. This one is " + n.name.replace("+", "").replace("#", " sharp")); if (!alive(s)) return;
    deafFor(900); tone(n.pitch, ctx.currentTime + 0.05, 0.6);
    await sleep(700); if (!alive(s)) return;
    await armGrading(s, "Try " + n.name + " again", line.say);
    return;
  }
  await speak(lesson.mistakesInLine > 1 ? "Let's listen once more, a bit slower." : "Oops! Let's hear that line again.");
  if (!alive(s)) return;
  await sleep(lesson.mistakesInLine > 0 ? 900 : 500); if (!alive(s)) return;
  if (!(await demoLine(s, lesson.mistakesInLine > 1))) return;
  lesson.idx = 0; lesson.lastOk = null;
  await armGrading(s, "Your turn, from the start of the line", line.say + " · start with " + curNote().name);
}
async function finishLine(s) {
  const line = curLine();
  const clean = lesson.mistakesInLine === 0 && !lesson.skipped;
  if (clean) lesson.clean++;
  starsEl.textContent = "⭐".repeat(lesson.clean);
  keyOn(null);
  say(clean ? "Perfect line! ⭐" : "You got it! 🎉", "good", line.say);
  await speak(clean ? PRAISE[lesson.pos % PRAISE.length] : "You got it!"); if (!alive(s)) return;
  await sleep(700); if (!alive(s)) return;
  line.notes.forEach(p => mark(line.index, p, null));
  lesson.pos++;
  if (lesson.pos >= lesson.order.length) {
    say("You finished! 🎉🎹", "good", lesson.clean + " of " + lesson.order.length + " lines with no mistakes");
    await speak("Fantastic! You played the whole thing!"); if (!alive(s)) return;
    stopLesson(true); return;
  }
  beginLine(s);
}
$("startLesson").addEventListener("click", async () => {
  if (lesson.on || micSession.starting) return; // [R1]
  $("startLesson").disabled = true; $("stopLesson").disabled = false;
  const s = ++lesson.session;
  if ($("voice").checked) unlockSpeech(); // [R11] inside the tap
  const audioOk = await ensureAudio();
  if (lesson.session !== s) return;
  if (!audioOk) { resetButtons(); say("No sound yet", "bad", "Tap Start lesson again. If it stays silent, close other apps using sound and reload."); return; }
  say("Listening to the room…", "", "Stay quiet for a second");
  const r = await startMic();
  if (lesson.session !== s || r === "cancelled") return;
  if (r !== "ok") { resetButtons(); say("I can't hear the piano yet", "bad", r === "nomic" ? "Teacher mode needs Safari on the iPad (it doesn't work inside the Claude app preview)." : "Allow the microphone for this page: in Safari tap aA › Website Settings › Microphone › Allow, then try again."); return; }
  lesson.on = true; lesson.order = ORDER[$("tPart").value]; lesson.pos = 0; lesson.clean = 0; starsEl.textContent = "";
  beginLine(s);
});
function resetButtons() { $("startLesson").disabled = false; $("stopLesson").disabled = true; }
function stopLesson(quiet) {
  const was = lesson.on || micSession.starting;
  lesson.session++; lesson.on = false; lesson.grading = false;
  stopSound(); stopMic();
  try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {}
  resetButtons();
  if (was && quiet !== true) { clearAllMarks(); keyOn(null); say("Lesson stopped", "", "Press Start lesson to go again"); }
}
$("stopLesson").addEventListener("click", () => stopLesson());
document.addEventListener("visibilitychange", () => { if (document.hidden) { stopLesson(); stopSound(); } });
})();
