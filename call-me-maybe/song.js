// Call Me Maybe (Carly Rae Jepsen, 2011): chorus, 0:28–0:52 of the official video (youtube fWNaR-rxAic). Right hand.
// Melody transcribed 2026-11-24 from the separated vocal track at 120 bpm.
// ABC conventions: L:1/8, key G, B, A, = the B and A below middle C, c = C5, "/" = half an eighth (a 16th), "-" ties.
// No lyrics are printed (only short cues); the line under the notes is the letter names.
(function () {
  const LINES = [
    { part: "A", say: "Hey, I just met you…", open: "|", close: "|", label: "Part A",
      bars: ["z2 G2 B,/D/ G D2", "z3 B, B,/D/ B2 G-"] },
    { part: "A", say: "But here's my number…", open: "|", close: "|",
      bars: ["G z2 G B c B G-", "G2 z G A A A G-"] },
    { part: "B", say: "It's hard to look right at you…", open: "|", close: "|", label: "Part B",
      bars: ["G z G z B, D/G/ D2", "z4 B, A, B2-"] },
    { part: "B", say: "But here's my number…", open: "|", close: "|",
      bars: ["B G z G B c B G-", "G2 z G A A A G-"] },
    { part: "A", say: "Hey, I just met you…", open: "|", close: "|", label: "Part A again",
      bars: ["G z G2 B,/D/ G D2", "z3 B, B,/D/ B2 G-"] },
    { part: "A", say: "But here's my number…", open: "|", close: "|]",
      bars: ["G z2 G B c B G-", "G2 z G A A A G-", "G2 z6"] },
  ];
  const MIDI = { "A,": 57, "B,": 59, D: 62, G: 67, A: 69, B: 71, c: 72 };
  const NAME = { "A,": "A−", "B,": "B−", D: "D", G: "G", A: "A", B: "B", c: "C+" };
  const ORDER = { all: [0, 1, 2, 3, 4, 5], A: [0, 1], B: [2, 3] };
  const WHITES = [57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74];
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
    let abc = "X:1\nT:\nM:4/4\nL:1/8\nK:G\n%%stretchlast 1\n";
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

  window.SONG = { LINES, ORDER, MIDI, WHITES, KEY_LABELS, buildAbc, ORIGINAL_BPM: 120,
    midiName: m => ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"][((m % 12) + 12) % 12] };
})();
