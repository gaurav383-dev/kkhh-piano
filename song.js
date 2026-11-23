// Kuch Kuch Hota Hai (rain-dance tune) — right hand.
// Rhythm measured from the piano cover audio (youtube JxzyvcIqWbg), 2026-11-23.
// ABC conventions: L:1/8, key G (so F means F#), c d e = C5 D5 E5, "-" ties to the next note.
// words: one token per written note ("_" = keep singing, "*" = no word, e.g. tied or instrumental notes).
(function () {
  const LINES = [
    { part: "A", say: "Tum paas aaye", open: "|:", close: "|", label: "Part A",
      bars: ["B c2 B2 A G2", "B8", "A3 G-G4"], words: "Tum paas _ aa _ ye * * *" },
    { part: "A", say: "Yoon muskuraaye", open: "|", close: "|",
      bars: ["B c2 B2 A G2", "B8", "A3 G-G4"], words: "Yoon mus ku raa _ ye * * *" },
    { part: "A", say: "Tumne na jaane kya", open: "|", close: "|",
      bars: ["A B2 A2 G F2", "A3 D-D4"], words: "Tum ne na jaa ne kya _ *", joinNext: true },
    { part: "A", say: "Sapne dikhaaye", open: "", close: ":|",
      bars: ["A2 G B2 A G2-", "G2 G4 z2"], words: "Sap ne di khaa _ * ye" },
    { part: "B", say: "Ab to mera dil", open: "|", close: "|", label: "Part B",
      bars: ["G G A2 B e3", "d6 z2"], words: "Ab to me ra dil _", joinNext: true },
    { part: "B", say: "Jaage na sota hai", open: "", close: "|",
      bars: ["G2 A B e2 e2", "d6 z2"], words: "Jaa ge na so ta hai" },
    { part: "B", say: "Kya karoon haaye", open: "|", close: "|",
      bars: ["A B2 A2 G F2", "E2 F E D4"], words: "Kya ka roon _ haa _ _ _ ye", joinNext: true },
    { part: "B", say: "Kuch kuch hota hai", open: "", close: "|",
      bars: ["A2 G A2 G G2", "G2 G6"], words: "Kuch kuch ho _ ta hai _" },
    { part: "B", say: "Kya karoon haaye", open: "|", close: "|",
      bars: ["A B2 A2 G F2", "E2 F E D4"], words: "Kya ka roon _ haa _ _ _ ye", joinNext: true },
    { part: "B", say: "Kuch kuch hota hai", open: "", close: "|]",
      bars: ["A2 G B2 A G2", "G8"], words: "Kuch kuch ho _ ta hai" },
  ];
  const MIDI = { D: 62, E: 64, F: 66, G: 67, A: 69, B: 71, c: 72, d: 74, e: 76 };
  const NAME = { D: "D", E: "E", F: "F#", G: "G", A: "A", B: "B", c: "C+", d: "D+", e: "E+" };
  const ORDER = { all: [0, 1, 2, 3, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9], A: [0, 1, 2, 3], B: [4, 5, 6, 7, 8, 9] };

  // tokens: every written note/rest (one per drawn element). presses: tied notes merged into one key press.
  LINES.forEach((line, li) => {
    line.index = li;
    line.tokens = [];
    line.bars.forEach(bar => bar.trim().split(/\s+/).forEach(chunk => {
      chunk.replace(/-/g, "- ").trim().split(" ").forEach(t => {
        const m = t.match(/^([zA-Ga-g])(\d*)(-?)$/);
        if (!m) throw new Error("Bad token " + t);
        const len = m[2] ? +m[2] : 1;
        line.tokens.push(m[1] === "z" ? { pitch: null, len } :
          { pitch: MIDI[m[1]], len, name: NAME[m[1]], tie: m[3] === "-" });
      });
    }));
    const words = line.words.split(/\s+/);
    let w = 0;
    line.tokens.forEach(t => { if (t.pitch) t.word = words[w++] || "*"; });
    line.presses = [];
    let tiedFrom = null;
    line.tokens.forEach((t, j) => {
      if (tiedFrom) { tiedFrom.len += t.len; tiedFrom.tokenIdx.push(j); tiedFrom = t.tie ? tiedFrom : null; return; }
      if (!t.pitch) { line.presses.push({ pitch: null, len: t.len, tokenIdx: [j] }); return; }
      const p = { pitch: t.pitch, name: t.name, len: t.len, word: t.word, tokenIdx: [j] };
      line.presses.push(p);
      if (t.tie) tiedFrom = p;
    });
    line.notes = line.presses.filter(p => p.pitch);
  });

  function buildAbc(tempo) {
    let abc = "X:1\nT:\nM:4/4\nL:1/8\nK:G\n%%stretchlast 1\n";
    let i = 0;
    while (i < LINES.length) {
      const group = [LINES[i]];
      while (group[group.length - 1].joinNext) group.push(LINES[++i]);
      i++;
      let music = "", words = [], names = [];
      group.forEach(line => {
        const bars = line.bars.slice();
        if (line.label) bars[0] = '"^' + line.label + '"' + bars[0];
        music += (line.open ? line.open + " " : "") + bars.join(" | ") + " " + line.close + " ";
        words.push(line.words);
        let prevTie = false;
        line.tokens.forEach(t => {
          if (!t.pitch) return;
          names.push(prevTie ? "*" : t.name);
          prevTie = t.tie;
        });
      });
      abc += music.trim() + "\nw: " + words.join(" ") + "\nw: " + names.join(" ") + "\n";
    }
    return abc;
  }

  window.SONG = { LINES, ORDER, MIDI, buildAbc, ORIGINAL_BPM: 120,
    midiName: m => ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"][((m % 12) + 12) % 12] };
})();
