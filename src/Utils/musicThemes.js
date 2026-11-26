/*
  The game's themes (Jamie, 2026-11-26), all original, for music.js to play. The list Jamie confirmed is in
  docs/BACKLOG.md (LOW 2, Sound system). Each theme:
  - melody: the lead, a token per note: "E5:2" is E5 for two sixteenths, "~F5:1" glides into it from the last note,
    ".:4" is four sixteenths' rest; "|" marks the bars (16 sixteenths each);
  - chords: a chord per bar ("Em7"), or for so many sixteenths ("C:8"); the bass and the harmony are played from them,
    in the named 'bass' and 'harmony' patterns (music.js);
  - drums: DRUMS presets, one a bar, repeating;
  - intense: what changes when the scene gets tense (setMusicIntensity(1)): its harmony and drums;
  - voices: an instrument per part for each style, over the defaults (music.js VOICES).
*/

// a bar of drums: a lane per drum (k kick, s snare, h hat, o open hat, r rim, t tom, c crash), "x" a hit, "X" accented
export const DRUMS = {
  swing: { k: "x.........x.....", r: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
  swingFill: { k: "x.........x.....", r: "....x.......x.x.", h: "x.x.x.x.x.x.x...", o: "..............x." },
  rock: { k: "x.......x.x.....", s: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
  rockFill: { k: "x.......x.......", s: "....x.......xxxX", h: "x.x.x.x.x.x....." },
  punk: { k: "x...x...x...x...", s: "....X.......X...", h: "x.x.x.x.x.x.x.x." },
  punkFill: { k: "x...x...x.......", s: "....X...xxxxXxXx", c: "x..............." },
  drive: { k: "x...x...x...x...", s: "....x.......x...", h: "xxxxxxxxxxxxxxxx" },
  driveCrash: { k: "x...x...x...x...", s: "....x.......x...", h: ".xxxxxxxxxxxxxxx", c: "x..............." },
  train: { k: "x.x.....x.x.....", s: "....x.......x...", h: "xxxxxxxxxxxxxxxx" },
  trainFill: { k: "x.x.....x.x.....", s: "....x.......xxXx", h: "xxxxxxxxxxxx...." },
  halftime: { k: "x.....x.........", s: "........X.......", h: "x.x.x.x.x.x.x.x." },
  stomp: { k: "X.......x.x.....", t: "......x.......x.", s: "....X.......X...", h: "..x...x...x...x." },
  stompFill: { k: "X.......x.x.....", t: "......x...tttt..".replace(/t/g, "x"), s: "....X...........", c: "x..............." },
  chase: { k: "x.....x...x.....", s: "....x.......x..x", h: "xxxxxxxxxxxxxxxx" },
  sparse: { k: "x.......x.......", h: "....x.......x..." },
  tick: { h: "x...x...x...x...", r: "..........x....." },
  drip: { r: "......x.........", h: "............x..." },
  heartbeat: { k: "x..x............" },
  march: { k: "x...x...x...x...", s: "..x...x...x.x.x." }
};

export const THEMES = {
  // - - - the characters (each also its area's walking level, Jamie) - - -
  agent: {
    name: "Sleazy Agent", group: "Characters",
    context: "Slinky, creeping, a swung walking bass and a sly sliding lead. The Street walk; a ~4 s sting of it whenever an Agent shows (the Lab showdown, the Agents dropping in, the radio calls).",
    bpm: 96, swing: 0.33,
    chords: "Em7 | Em7 | Am7 | Am7 | Em7 | C7 | B7 | B7",
    bass: "walk", harmony: "stabs", drums: ["swing", "swing", "swing", "swing", "swing", "swing", "swing", "swingFill"],
    melody: ".:2 B4:2 ~C5:1 B4:3 G4:2 E4:4 .:2 | .:4 D5:2 ~Eb5:1 E5:5 .:4 | .:2 A4:2 C5:2 E5:2 ~Eb5:2 D5:2 C5:2 A4:2 | G4:3 A4:1 C5:4 .:8 | .:2 B4:2 ~C5:1 B4:3 G4:2 E4:2 G4:2 Bb4:2 | ~B4:6 .:2 E5:2 ~F5:1 E5:3 C5:2 | B4:2 D#5:2 F#5:2 A5:2 ~G#5:1 G5:1 F#5:2 D#5:2 B4:2 | ~C5:1 B4:7 .:8",
    voices: { chip: { lead: "pulse25" }, synth: { lead: "saw" } }
  },
  punk: {
    name: "Punk Guy", group: "Characters",
    context: "Fast, scrappy, driving power chords. The Subway walk, his intro and his recruit choice.",
    bpm: 152,
    chords: "A5 | A5 | F5 | G5 | A5 | A5 | C5:8 G5:8 | E5",
    bass: "octave8", harmony: "chug", drums: ["punk", "punk", "punk", "punk", "punk", "punk", "punk", "punkFill"],
    melody: "A4:2 A4:2 C5:2 A4:2 D5:3 C5:1 A4:2 G4:2 | A4:4 .:2 E4:2 G4:2 A4:6 | F4:2 F4:2 A4:2 C5:2 F5:4 E5:2 C5:2 | D5:4 B4:4 G4:4 .:4 | A4:2 A4:2 C5:2 A4:2 D5:3 C5:1 A4:2 E5:2 | ~G5:2 E5:2 D5:2 C5:2 A4:8 | C5:2 E5:2 G5:4 B4:2 D5:2 G5:4 | E5:4 ~G#5:4 E5:4 .:4",
    voices: { chip: { lead: "pulse50" } }
  },
  ghostGirl: {
    name: "Ghost Girl", group: "Characters",
    context: "Eerie and lonely, a music box with an echo. The Rooftop walk, her intro and her recruit choice.",
    bpm: 76,
    chords: "Dm | Bb | Gm | A | Dm | Bb | Gm6 | A7",
    bass: "long", harmony: "musicbox", drums: [],
    melody: "A5:6 F5:2 E5:4 D5:4 | F5:8 .:4 D5:4 | Bb4:4 D5:4 G5:6 F5:2 | E5:12 .:4 | A5:6 F5:2 E5:4 D5:4 | D6:6 C6:2 Bb5:4 F5:4 | G5:4 E5:4 ~C#5:4 E5:4 | D5:12 .:4",
    voices: { chip: { lead: "triangleLead" }, synth: { lead: "softLead" } }
  },
  mermaid: {
    name: "The Mermaid", group: "Characters",
    context: "Flowing and dreamy, watery arpeggios. The Aquarium walk, her intro and her recruit choice.",
    bpm: 84,
    chords: "Ebmaj7 | Cm7 | Abmaj7 | Bb | Ebmaj7 | Gm7 | Abmaj7 | Bbsus4:8 Bb:8",
    bass: "rootFifth", harmony: "arp16", drums: [],
    melody: "G5:6 Bb5:2 G5:4 F5:4 | Eb5:8 G5:4 C6:4 | Bb5:6 Ab5:2 G5:4 Eb5:4 | F5:12 .:4 | G5:6 Bb5:2 Eb6:4 D6:4 | Bb5:8 .:4 G5:4 | Ab5:4 C6:4 Eb6:4 C6:4 | Bb5:12 .:4",
    voices: { chip: { lead: "pulse50" }, synth: { lead: "softLead" } }
  },
  teammate: {
    name: "The teammate", group: "Characters",
    context: "Warm and hopeful, the friend's theme. For now it's heard in the credits; the final battle is built on it, and its slow take below plays at the final turn. Where else should it play?",
    bpm: 108,
    chords: "G | D | Em | C | G | D | C | D",
    bass: "rootFifth", harmony: "arp8", drums: ["rock", "rock", "rock", "rockFill"],
    melody: "B4:4 D5:4 G5:6 F#5:2 | E5:4 D5:4 A4:8 | B4:4 E5:4 G5:4 F#5:4 | E5:8 .:4 D5:4 | B4:4 D5:4 G5:4 B5:4 | A5:6 F#5:2 D5:8 | E5:4 G5:4 C6:4 B5:2 A5:2 | A5:4 B5:4 ~D6:8",
    voices: { chip: { lead: "pulse50" } }
  },
  teammateSad: {
    name: "The teammate (slow, the final turn)", group: "Characters",
    context: "The teammate's theme slowed and in a minor key, with no drums: the final turn, as the teammate becomes a Kaiju.",
    bpm: 66,
    chords: "Gm | Dm | Eb | Cm | Gm | D | Cm | D",
    bass: "long", harmony: "pad", drums: [],
    melody: "Bb4:4 D5:4 G5:6 F#5:2 | F5:4 D5:4 A4:8 | Bb4:4 Eb5:4 G5:4 F5:4 | Eb5:8 .:4 D5:4 | Bb4:4 D5:4 G5:4 Bb5:4 | A5:6 F#5:2 D5:8 | Eb5:4 G5:4 C6:4 Bb5:2 A5:2 | A5:4 C6:4 ~D6:8",
    voices: { chip: { lead: "triangleLead", harmony: "pulse12" }, synth: { lead: "softLead" } }
  },

  // - - - the battles (tense; training and sparring play them lighter) - - -
  subwayBattle: {
    name: "Subway battle", group: "Battles",
    context: "Urgent, the train's rhythm in the drums. Punk Guy's fight; lighter for the Subway's training and sparring; the Rapid Transit multiplayer ground.",
    bpm: 160,
    chords: "Em | Em | C | D | Em | Em | Am | B",
    bass: "octave8", harmony: "stabs", drums: ["train", "train", "train", "trainFill"],
    melody: "E5:2 .:2 E5:2 G5:2 .:2 F#5:2 E5:2 D5:2 | B4:6 .:2 B4:2 D5:2 E5:4 | C5:2 .:2 C5:2 E5:2 .:2 G5:2 E5:2 C5:2 | D5:4 F#5:4 A5:4 F#5:4 | E5:2 .:2 E5:2 G5:2 .:2 B5:2 A5:2 G5:2 | E5:8 .:4 B4:4 | A4:2 C5:2 E5:2 A5:2 G5:2 E5:2 C5:2 A4:2 | B4:4 D#5:4 F#5:4 B5:4"
  },
  rooftopBattle: {
    name: "Rooftop battle", group: "Battles",
    context: "Tense and haunted, Ghost Girl's tune turned to a fight; it grows more intense when the ghost rings start (play it with 'Tense' on). Her fight; lighter for training and sparring; the Rooftop multiplayer ground.",
    bpm: 128,
    chords: "Dm | Dm | Bb | A | Dm | Dm | Gm | A7",
    bass: "root8", harmony: "stabs", drums: ["halftime"],
    intense: { harmony: "arp16", drums: ["drive", "drive", "drive", "driveCrash"] },
    melody: "A5:4 F5:2 E5:2 D5:4 .:4 | D5:2 E5:2 F5:2 A5:2 G5:4 F5:4 | F5:4 D5:2 C5:2 Bb4:4 .:4 | A4:2 C#5:2 E5:2 A5:2 G5:4 E5:4 | A5:4 F5:2 E5:2 D5:4 .:4 | D6:4 C6:2 Bb5:2 A5:4 F5:4 | G5:4 Bb5:4 D6:4 Bb5:4 | A5:2 G5:2 F5:2 E5:2 C#5:8"
  },
  aquariumBattle: {
    name: "Aquarium battle", group: "Battles",
    context: "Pressing and heavy, the Mermaid's tune in a dark key; it builds when the glass breaks and the water runs ('Tense'). Her fight; lighter for training and sparring; the Aquarium multiplayer grounds.",
    bpm: 120,
    chords: "Cm | Cm | Ab | Bb | Cm | Cm | Fm | G7",
    bass: "root8", harmony: "pad", drums: ["halftime"],
    intense: { harmony: "arp16", drums: ["drive", "drive", "drive", "driveCrash"] },
    melody: "G5:6 Eb5:2 C5:4 D5:4 | Eb5:8 D5:4 B4:4 | C5:4 Eb5:4 Ab5:6 G5:2 | F5:8 D5:8 | G5:6 Eb5:2 C6:4 Bb5:4 | G5:8 .:4 Eb5:4 | F5:4 Ab5:4 C6:4 Ab5:4 | G5:4 F5:4 D5:4 B4:4"
  },
  kaijuFight: {
    name: "Kaiju fight", group: "Battles",
    context: "Big and stompy: the first take's tune, at Punk Guy's tempo with his driving drums and bass (Jamie's redo, 2026-11-26), a stomp in its fills. The Peninsula's fights against the Kaiju from the sea, the Peninsula multiplayer ground and the defense mode.",
    bpm: 152,
    chords: "E5 | E5 | E5 | F5 | E5 | E5 | C5 | B5",
    bass: "octave8", harmony: "chug", drums: ["punk", "punk", "punk", "stompFill", "punk", "punk", "punk", "punkFill"],
    melody: "E4:4 .:2 E4:2 G4:4 F#4:4 | E4:4 B3:4 .:8 | E4:4 .:2 E4:2 G4:2 A4:2 B4:4 | C5:6 B4:2 A4:4 F4:4 | E5:4 .:2 E5:2 G5:4 F#5:4 | E5:4 B4:4 .:8 | C5:4 E5:4 G5:4 E5:4 | D#5:4 F#5:4 B5:8",
    voices: { chip: { lead: "pulse50" } }
  },
  finalBattle: {
    name: "Final battle", group: "Battles",
    context: "The boss theme: tragic and fierce, the teammate's theme in a minor key at full tilt. The teammate turned Kaiju.",
    bpm: 140,
    chords: "Gm | Dm | Eb | Cm | Gm | D | Cm | D7",
    bass: "octave8", harmony: "tremolo", drums: ["drive", "drive", "drive", "driveCrash"],
    melody: "Bb4:4 D5:4 G5:6 F#5:2 | F5:4 D5:4 A4:8 | Bb4:4 Eb5:4 G5:4 F5:4 | Eb5:8 .:4 D5:4 | Bb4:4 D5:4 G5:4 Bb5:4 | A5:6 F#5:2 D5:8 | Eb5:4 G5:4 C6:4 Bb5:2 A5:2 | A5:4 C6:4 ~D6:8",
    voices: { chip: { lead: "pulse25" } }
  },
  labEscape: {
    name: "Lab escape", group: "Battles",
    context: "A chase, fast and alarmed, a siren in the lead. The trap and the Agents chasing; the Lab multiplayer ground.",
    bpm: 168,
    chords: "Am | Am | Bb | Bb | Am | Am | F | E",
    bass: "pulse16", harmony: "stabs", drums: ["chase", "chase", "chase", "driveCrash"],
    melody: "A5:2 G#5:2 A5:2 E5:2 A5:2 G#5:2 A5:2 C6:2 | B5:4 A5:4 E5:8 | Bb5:2 A5:2 Bb5:2 F5:2 Bb5:2 A5:2 Bb5:2 D6:2 | C6:4 Bb5:4 F5:8 | A5:2 G#5:2 A5:2 E5:2 A5:2 G#5:2 A5:2 C6:2 | E6:4 D6:4 C6:4 B5:4 | A5:2 F5:2 C5:2 F5:2 A5:2 C6:2 F6:4 | E6:4 B5:4 G#5:4 E5:4"
  },

  // - - - places - - -
  peninsulaMap: {
    name: "Peninsula map", group: "Places",
    context: "A travel theme with a radar-blip feel. Walking the radar map between areas.",
    bpm: 100,
    chords: "C | D | G | Em | C | D | G | G",
    bass: "rootFifth", harmony: "arp8", drums: ["tick"],
    melody: "E5:4 G5:4 C6:6 B5:2 | A5:4 F#5:4 D5:8 | G5:4 B5:4 D6:4 B5:4 | G5:12 .:4 | E5:4 G5:4 C6:4 E6:4 | D6:6 C6:2 A5:8 | B5:4 G5:4 D5:4 G5:4 | G5:12 .:4",
    voices: { chip: { lead: "pulse50" } }
  },
  lab: {
    name: "The Lab", group: "Places",
    context: "Cold, humming and uneasy. The Lab walk, the vat and the class battle preview.",
    bpm: 90,
    chords: "Am | Bbmaj7 | Am | E | Am | Bbmaj7 | Dm | E",
    bass: "long", harmony: "arp8", drums: ["sparse"],
    melody: ".:4 E5:4 F5:4 E5:4 | D5:8 .:8 | .:4 C5:4 B4:4 A4:4 | G#4:12 .:4 | .:4 E5:4 F5:4 A5:4 | G5:8 F5:8 | F5:4 E5:4 D5:4 F5:4 | E5:12 .:4",
    voices: { chip: { lead: "pulse12" }, synth: { lead: "softLead", harmony: "pad" } }
  },
  sewers: {
    name: "The Sewers", group: "Places",
    context: "Dark, dripping and low; it swells as you near the glowing door, and at the whiteout climb ('Tense'). Both Sewers levels.",
    bpm: 70,
    chords: "Cm | Cm | Db | Cm | Cm | Ab | Db | G",
    bass: "long", harmony: "pad", drums: ["drip"],
    intense: { harmony: "arp16", drums: ["heartbeat"] },
    melody: "C5:8 .:4 Eb5:4 | D5:4 C5:4 G4:8 | Ab4:8 F4:8 | G4:12 .:4 | C5:8 .:4 G5:4 | F5:4 Eb5:4 C5:8 | Db5:8 F5:8 | D5:8 B4:8",
    voices: { chip: { lead: "triangleLead" }, synth: { lead: "softLead" } }
  },

  // - - - screens - - -
  title: {
    name: "Start screen (title)", group: "Screens",
    context: "The game's title theme: the monitor's PLAY screen and the multiplayer setup; the landing too, once the page has been clicked.",
    bpm: 126,
    chords: "Dm | Bb | C | A | Dm | Bb | Gm | A",
    bass: "octave8", harmony: "stabs", drums: ["rock", "rock", "rock", "rockFill"],
    melody: "D5:4 A4:2 D5:2 F5:4 E5:2 D5:2 | D5:4 F5:4 Bb5:6 A5:2 | G5:4 E5:2 C5:2 G5:4 A5:2 G5:2 | E5:8 C#5:8 | D5:4 A4:2 D5:2 F5:4 A5:2 D6:2 | D6:4 C6:2 Bb5:2 F5:8 | G5:4 Bb5:4 D6:4 C6:2 Bb5:2 | A5:4 E5:4 C#5:4 A4:4",
    voices: { chip: { lead: "pulse25" } }
  },
  menu: {
    name: "Avatar select and picker", group: "Screens",
    context: "The title theme's calm take, to think over: the avatar select and the power picker.",
    bpm: 96,
    chords: "Dm | Bb | C | A | Dm | Bb | Gm | A",
    bass: "long", harmony: "arp8", drums: ["sparse"],
    melody: "D5:4 A4:2 D5:2 F5:4 E5:2 D5:2 | D5:4 F5:4 Bb5:6 A5:2 | G5:4 E5:2 C5:2 G5:4 A5:2 G5:2 | E5:8 C#5:8 | D5:4 A4:2 D5:2 F5:4 A5:2 D6:2 | D6:4 C6:2 Bb5:2 F5:8 | G5:4 Bb5:4 D6:4 C6:2 Bb5:2 | A5:4 E5:4 C#5:4 A4:4",
    voices: { chip: { lead: "pulse12" }, synth: { lead: "softLead" } }
  },
  credits: {
    name: "Credits", group: "Screens",
    context: "A medley: the teammate, the Agent, Punk Guy, Ghost Girl, the Mermaid, and the title, each once through.",
    bpm: 108,
    medley: ["teammate", "agent", "punk", "ghostGirl", "mermaid", "title"]
  }
};
