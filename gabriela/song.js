// Gabriela (KATSEYE, 2025): chorus, 0:30–1:01 of the Performance Video (youtube co-TFLbaZAE). Right hand.
// Melody transcribed 2026-11-26 from the separated vocal track (demucs) at 146 bpm, simplified to eighth notes.
// ABC conventions: L:1/8, key A minor (white keys only), A, = the A below middle C, c d = C5 D5, "-" ties.
// No lyrics are printed (only short cues); the line under the notes is the letter names.
(function () {
  const LINES = [
    { part: "S", say: "I'm begging you…", open: "|", close: "|", label: "Start",
      bars: ["C", "F E D3 z3"] },
    { part: "A", say: "Hands off, Gabriela…", open: "|", close: "|", label: "Part A",
      bars: ["D E D E D C C D-", "D z3 D C2 D"] },
    { part: "A", say: "Hands off…", open: "|", close: "|",
      bars: ["D E D E D C C D-", "D C D A, z4"] },
    { part: "A", say: "Back off of my fella…", open: "|", close: "|",
      bars: ["D E D E D C C D-", "D z3 D C C D"] },
    { part: "A", say: "Back off…", open: "|", close: "|",
      bars: ["D E D E D C2 D", "D C A,2 z4"] },
    { part: "B", say: "'Cause, ooh…", open: "|", close: "|", label: "Part B",
      bars: ["A,3 A3 z2", "z A c d B c A E-"] },
    { part: "B", say: "…I'm begging you", open: "|", close: "|",
      bars: ["E G G3 z2 C", "F E D3 z3"] },
    { part: "A", say: "Hands off, Gabriela…", open: "|", close: "|", label: "Part A again",
      bars: ["D E D E D C C D", "E z3 D C C D"] },
    { part: "A", say: "Hands off…", open: "|", close: "|",
      bars: ["D E D E D C C D", "D2 A, z3 C D"] },
    { part: "A", say: "…la-la-la-la", open: "|", close: "|]",
      bars: ["D C D E D C D2-", "D2 z6"] },
  ];
  const MIDI = { "A,": 57, C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71, c: 72, d: 74 };
  const NAME = { "A,": "A−", C: "C", D: "D", E: "E", F: "F", G: "G", A: "A", B: "B", c: "C+", d: "D+" };
  const ORDER = { all: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], A: [1, 2, 3, 4], B: [5, 6] };
  const WHITES = [57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76];
  const KEY_LABELS = { 57: "A−", 59: "B−" };

  // tokens: every written note/rest (one per drawn element). presses: tied notes merged into one key press.
  // A note tied over from the previous line becomes a silent "hold" press, so each line starts on a new key.
  let carry = null;
  LINES.forEach((line, li) => {
    line.index = li;
    line.tokens = [];
    line.bars.forEach(bar => bar.trim().split(/\s+/).forEach(chunk => {
      const toks = chunk.match(/[zA-Ga-g],?\d*\/?-?/g) || [];
      if (toks.join("") !== chunk) throw new Error("Bad chunk " + chunk);
      toks.forEach(t => {
        const m = t.match(/^([zA-Ga-g],?)(\d*)(\/?)(-?)$/);
        const len = (m[2] ? +m[2] : 1) * (m[3] ? 0.5 : 1);
        if (m[1] !== "z" && !(m[1] in MIDI)) throw new Error("Unknown note " + m[1]);
        line.tokens.push(m[1] === "z" ? { pitch: null, len } :
          { pitch: MIDI[m[1]], len, name: NAME[m[1]], tie: m[4] === "-" });
      });
    }));
    line.presses = [];
    let tiedFrom = null;
    line.tokens.forEach((t, j) => {
      if (carry) { // continuation of a note tied over the line break
        t.carried = true;
        line.presses.push({ pitch: null, hold: carry, len: t.len, tokenIdx: [j] });
        if (!t.tie) carry = null;
        return;
      }
      if (tiedFrom) { t.carried = true; tiedFrom.len += t.len; tiedFrom.tokenIdx.push(j); tiedFrom = t.tie ? tiedFrom : null; return; }
      if (!t.pitch) { line.presses.push({ pitch: null, len: t.len, tokenIdx: [j] }); return; }
      const p = { pitch: t.pitch, name: t.name, len: t.len, tokenIdx: [j] };
      line.presses.push(p);
      if (t.tie) tiedFrom = p;
    });
    carry = tiedFrom ? tiedFrom.pitch : null;
    line.notes = line.presses.filter(p => p.pitch);
  });

  function buildAbc() {
    let abc = "X:1\nT:\nM:4/4\nL:1/8\nK:Am\n%%stretchlast 1\n";
    let i = 0;
    while (i < LINES.length) {
      const group = [LINES[i]];
      while (group[group.length - 1].joinNext) group.push(LINES[++i]);
      i++;
      let music = "", names = [];
      group.forEach(line => {
        const bars = line.bars.slice();
        if (line.label) bars[0] = '"^' + line.label + '"' + bars[0];
        music += (line.open ? line.open + " " : "") + bars.join(" | ") + " " + line.close + " ";
        line.tokens.forEach(t => { if (t.pitch) names.push(t.carried ? "*" : t.name); });
      });
      abc += music.trim() + "\nw: " + names.join(" ") + "\n";
    }
    return abc;
  }

  window.SONG = { LINES, ORDER, MIDI, WHITES, KEY_LABELS, buildAbc, ORIGINAL_BPM: 146,
    midiName: m => ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"][((m % 12) + 12) % 12] };
})();
