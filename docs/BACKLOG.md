# Kaiju City: backlog and playtest checklist

A shared list between Jamie and Claude. Claude reads it at the start of each session and keeps it up to date.

**How to use it**
- Tick a checklist box when an item is confirmed: `- [x]`.
- To comment, reply or ask, write an indented line under the item, starting with your name:
  - `> Jamie: ...` for Jamie's notes.
  - `> Claude: ...` for Claude's answers.
- New items can go anywhere. Claude will sort them into place and ask about anything unclear.
- Once Jamie marks an item done, Claude moves it to [DONE.md](DONE.md), into its section there (newest at the top).

Last updated: 2026-11-28.

---

## Backlog

### HIGH
1. Check the playtest 41 list (below), and the items still open from 39 + 40.
2. HUD drawing area too small: the HUDs get cut off on the right (and maybe the bottom) when they bob around and when they crash and burn. The right side is worth fixing; the bottom maybe not.
   > Claude (2026-11-25): fixed, please check. It wasn't the HUDs' own canvas (it has 700 px of room all round) but the game frame: it clipped everything at its edges, a line from before the apartment, now in the middle of the room. The frame no longer clips, so the HUDs can bob and crash past it (right and bottom both), as can the console flying off and anything else crossing it. Checked: the start screen, avatar select, the picker, the console flying off, the HUDs flying in, a fight.
3. Apartment room: built, waiting on Jamie's playtest.

### MEDIUM
1. Main monitor and side tech mock-ups: Jamie makes the mock-ups (monitor casing, side monitor and console scales), then Claude matches the code to them. The casing mock-up of 2026-11-25 (thicker border, grilles, volume buttons) builds toward this.
2. Mobile and responsive layout, one feature:
   - breakpoints and a placement tool (layout phase 4);
   - cqw sizing on all the UI;
   - iPad and iPhone sizing;
   - controls: a virtual joystick on the left and three ability buttons on the right, all clear "Liquid Glass";
   - framing: the apartment only during the landing zoom, then a tighter game frame without the monitor and side elements, and no drink mechanic.
   > Claude (2026-11-28): agreed with Jamie and started on `feature/mobile`. Four steps: (1) touch mode, full-screen game and the touch HUD; (2) the screens before a level; (3) the placement tool and per-device tuning (playWindow.json needs a section per device); (4) polish. **Step 1 built, please check** (on your phone: run `npm run dev -- --host` and open the Network address it prints; or on the PC add `?device=phone` to the address, or pick Device in the touch menu):
   - [x] A phone held upright shows "Turn your phone sideways to play".
   - [x] In a level (fight, walk or radio call): no room, no monitor casing; the game fills the screen.
   - [x] The joystick (left) walks in 8 directions; letting go stops.
   - [x] The three power buttons fire 1, 2, 3; their cooldown is a dark wedge sweeping away; the bead on the rim lights when ready.
   - [x] Health capsules; passive dots, dim until they work, with their smoke rising.
   - [x] The objective runs across the top every 7 s (tune `TICKER` in Touch/touchLayouts.js).
   - [x] The menu button (top left) pauses; Resume, Controls, volume, Quit.
   - [x] Dialogue: the panel on the right; the scene pushed left beside it, same size; tap the panel or Continue.
   > Claude (2026-11-28): Jamie's iPhone playtest of step 1 is built; everything to check is in the **Mobile feature checklist** below, which grows with each step. Jamie playtests once all steps are done.
   - Known for later steps: the screens before a level (start, avatar select, picker, vat) still show the monitor; the whole-scene shots in cutscenes leave black at the side (a phone is wider than the scenes); the camera can put the player near the joystick.
3. Tab icon (favicon):
   - The roaring right-hand landing Kaiju (facing left, silhouette) with the purple lo-fi fire mid-spew.
   - A tool for it: a static mid-spew Kaiju and fire; rescale and place both; a framing circle Jamie sizes and places; an inner circle where a fade starts, fully clear by the outer circle; export.
   - Then Claude makes the icon set as for SpellCraft (../QuickCast): favicon.ico (16/32/48), favicon-32, apple-touch 180, icon-192, icon-512, a webmanifest, loaded with the first loader.
   > Claude (2026-11-25): the tool is built: open `localhost:5180/icon` (dev server). Pick Kaiju, Fire or Circle; drag to move, mouse wheel to scale; sliders for everything. Previews at 16, 32, 48 (on a dark tab, a light tab and clear) and 180. **Save** keeps your settings (iconTool.json); **Export 1024 px** downloads the image and writes it to `public/icon-source/kaiju-icon.png`. When you're happy with it, tell me and I'll run `scripts/makeIcons.py` (ready) to make the icon set and add the tags to index.html.
   > Claude (2026-11-25): made from your final export: favicon.ico (16, 32, 48), favicon-32.png, apple-touch-icon.png (180), icon-192.png, icon-512.png and site.webmanifest in `public/`, and the tags in index.html. Tick this item when you've seen it in the tab and I'll move it to DONE.md.
4. The zoom in from the landing, its issues (Jamie, 2026-11-26). Fixed 2026-11-27: see Misc2 below.
   - [ ] On the left side of the apartment's slow zoom in, duplicate pictures of the apartment scene show, not lined up with each other.
   - [ ] From the cityscape to the apartment's outside shot, the site seems to slow down. It may be the effect itself; to check whether it's dropping frames.
   - [ ] There may be other issues. Claude: remind Jamie to look the whole zoom over for others when this item comes up.
5. 80s synthwave music (Jamie, 2026-11-28; its own branch). Re-theme the current music as 80s synthwave: keep the tracks Jamie likes (most of them) and change their sound, and rewrite any that don't carry over.
   > Claude: doable in the same code-made music system: a third style beside "8-bit" and "synth", with gated-reverb drums, detuned saw pads and leads, arpeggiated bass, chorus and a big hall. Each theme keeps its tune and chords; the ones that don't suit it (likely the punk and Kaiju fight, at 152 bpm) get new parts. You'd review them on /music as now.


### LOW (Jamie's order, before merging to master)
1. Re-enable localStorage saves: one compressed save of all unlocks, maybe one-word codes read on load or on Play.
   > Claude: this is also listed under Shelved (Jamie said to move it there too). Which one?
   > Jamie: Woops! Sorry, we just want to implement so that it is clean / not saving a bunch of localstorage data to user's comp, and ensure the app is able to read it cleanly. the unlocked content should be done "intelligently" so that it adds to singleplayer/multiplayer experience w/o detracting from it. will need to discuss.
   > Jamie: please remove this one from "Shelved" section if repeated there.
   > Claude: done: removed from Shelved. Noted: a small, clean save that the app reads reliably, and unlocks designed to add to single player and multiplayer without taking away from either. We'll discuss the design before building it.
2. Sound system: 42 proposed effects waiting on Jamie's review. The volume buttons and bars exist for it (`VOLUME_LEVEL` in PlayWindow.jsx).
   > Claude (2026-11-25): built for your review at **/sounds** (dev server): 94 sounds, all made in code (no files). The landing's and the shelved final battle's are left out, and so is music. Each has where it plays, a Play button, Approve / Redo / Cut and a note; your verdicts save to `src/Game/ReactComponents/SoundReview/soundReview.json`. Nothing plays in the game yet.
   - [x] Jamie: go through /sounds, Approve / Redo / Cut each. (2026-11-26: all 94 approved)
   - [x] Claude: put the approved sounds in the game. (2026-11-26: done, low priority as you said; checks below)
   - [x] Jamie: music (landing theme, level loops, boss theme, credits): made in code like these, from a library, or by a composer? (2026-11-26: made in code, some 8-bit, some not; a /music tool like /sounds)
   - **Music: the proposed themes, held for your confirmation (2026-11-26).** Strike any, add any, and say 8-bit or not where you have a view. Each is an original loop; the place it plays is in brackets.
     - Character themes (each shared with that area's walking level, as you said):
       - [ ] 1. **Sleazy Agent**: slinky and creeping, swung walking bass, sly sliding lead. (The Street walk; a ~4 s sting of it whenever an Agent shows: the Lab showdown, the Agents dropping in, the radio calls.)
       - [ ] 2. **Punk Guy**: fast, scrappy, driving. (The Subway walk, his intro and his recruit choice.)
       - [ ] 3. **Ghost Girl**: eerie and lonely, a music-box feel, echo. (The Rooftop walk, her intro and recruit choice.)
       - [ ] 4. **The Mermaid**: flowing and dreamy, watery arpeggios. (The Aquarium walk, her intro and recruit choice.)
       - [ ] 5. **The teammate** (optional): warm and hopeful, the friend's theme. (The greeting on the Street, sparring, and a sad, slow take for the final turn.)
     - Battle themes (tense, different from the area's walking theme):
       - [ ] 6. **Subway battle**: urgent, with the train's rhythm in the drums. (Punk Guy's fight.)
       - [ ] 7. **Rooftop battle**: tense and haunted; it gets more intense when the ghost rings start. (Ghost Girl's fight.)
       - [ ] 8. **Aquarium battle**: pressing and heavy; it builds when the glass breaks and the water runs. (The Mermaid's fight.)
       - [ ] 9. **Kaiju fight**: big and stompy, heavy bass. (The Peninsula fights against the Kaiju from the sea.)
       - [ ] 10. **Final battle**: the boss theme, tragic and fierce, built on the teammate's theme if 5 stays. (The teammate turned Kaiju.)
       - [ ] 11. **Lab escape**: a chase, fast and alarmed. (The trap and the Agents chasing.)
       - [ ] 12. **Multiplayer match**: competitive, upbeat and energetic.
       - [ ] 13. **Training and sparring**: the area's battle theme, lighter (fewer parts). Or one shared training theme? Your call.
     - Places:
       - [ ] 14. **Peninsula map**: a travel theme, with a radar-blip feel. (Walking the radar map between areas.)
       - [ ] 15. **The Lab**: cold, humming, uneasy. (The Lab walk, the vat, the class battle preview.)
       - [ ] 16. **The Sewers**: dark, dripping and low, swelling as you near the glowing door. (Both Sewers levels; the whiteout climb at the end gets a rise of its own.)
     - Screens and moments:
       - [ ] 17. **Start screen**: the game's title theme. (The monitor's PLAY screen. Should the landing get it too?)
       - [ ] 18. **Avatar select and picker**: calm and curious, so you can think. (A quieter take of 17?)
       - [ ] 19. **Credits**: a medley of the character themes.
     - Not on the list: win and lose (the approved win/lose stings cover them). Cutscenes and dialogue keep the scene's music, turned down under the words.
   > Jamie (2026-11-26): both versions of each (8-bit and not); keep #5; #13 yes (lighter battle versions); multiplayer needs no theme of its own (its setup reuses the menu music); the landing plays the title too.
   > Claude (2026-11-26): all built. #12 struck: multiplayer fights play their battleground's battle theme. #14 (the Peninsula map) kept; strike it if you meant that one. Sparring plays the lighter battle, like training. The teammate's own theme (#5) now plays only in the credits; its slow take plays at the final turn, and the final battle is built on it. Where else should #5 play?
   - [ ] Jamie: go through **/music** (dev server). Each theme loops; play it as 8-bit and as not 8-bit, then pick "Use" for the game, and Approve / Redo / Cut with a note. Battles also play "Light"; Rooftop, Aquarium and Sewers have "Tense"; the Agent has its 4 s sting. Until you pick, the game plays 8-bit.
   - Built 2026-11-26, to check in your next playtest:
     - [ ] Music changes with the screen: the title on the landing (after your first click or key) and on the monitor's start screen; the calm take on the avatar select, picker and vat; each level's own (see the list above).
     - [ ] A recruit's area: their theme on the walk and at their intro, the battle theme from the moment the Kaiju part is touched, their theme again at the recruit choice. Rooftop gets tenser with the ghost rings, the Aquarium once the glass breaks.
     - [ ] The Lab: its theme walking; the Agent's theme for the showdown talk; the Lab escape once the Agents fight or chase. Each Agent dropping in plays the Agent's 4 s sting over the music.
     - [ ] Final fight: Kaiju fight, the teammate's slow take as they turn, then the final battle. Credits play the medley.
     - [ ] The music drops under dialogue, speech balloons and radio calls, and comes back after; it fades for the win and lose stings.
     - [ ] The volume buttons on the monitor set the music, the sounds and the loops together.
     - [ ] Sounds: every button ticks on hover and clicks; the console's Play! and Back, and the side monitor's round buttons, have their own; arrows on the console tick.
     - [ ] Monitor: CRT on/off, boot ticks as the matrix cascades, LCD beeps as the side monitor's words change, the bios' typewriter, Stompy's chirp, poop, happy and sad, the room's tubes clunking on, the hologram shimmer.
     - [ ] Picker: the lock-in clunk on each power; the third adds the combo ding and the class sting; Play! and the side units' whoosh as they fly off.
     - [ ] HUD drones: jets in and out, a jostle when hit, the malfunction once low, the fall and fireball when one dies.
     - [ ] Fights: each power's cast (yours loudest), passives, hits, KOs and ragdolls, your footsteps, Kaiju stomps, the last blow's slow-motion boom, the win and lose stings, the retry's hit on Try again, the new-objective notes, the unlock ding (the original, for unlocks and the reward and recruit cards; the other take cut, as you said).
     - [ ] Dialogue: each speaker's blips as their line types (Guy, Girl, Punk Guy, Ghost Girl, the Mermaid, the Agent; others share one), radio static under radio calls.
     - [ ] Levels: the Subway's bell, train, brakes and doors, and its echo on every sound; Rooftop wind, Ghost Girl's scream and the rings; Aquarium hum, the glass crack, "Stop!!!", the shatter, the flood, sea creatures, the Mermaid's heal; Lab machines and the vat's bubbling, the trap clang, the escape siren, the vat-dip scream; Sewers drips (with echo) and the door's glow; the Street's cars and the Agent's call; the Peninsula's city.
     - [ ] Tiles: fire, water, electric and ghost tiles add their loops, louder the more tiles have them.
     - [ ] Boss phase changes (Ghost Girl's scream, the Mermaid's "Stop!!!") also play the "turn change" tone.
   > Jamie (2026-11-26): a dev option for 8-bit or not; dev toggles for music and sound effects; approve or redo music and sounds in the game with a comment box; redo the Kaiju fight; the volume controls hooked up.
   - Built 2026-11-26 (later), to check tomorrow:
     - [ ] **Sound (dev) panel**, bottom left on every game screen (hidden with the other dev options, F2; "hide" folds it): Music and Sound effects switches (the second takes the loops too); Style: each theme's /music pick, all 8-bit, or all not 8-bit (the theme playing switches over at once).
     - [ ] In the panel: the theme playing now, with Approve / Redo / Cut and a note; below it a sound you've heard (pick another from the list of recent ones), the same. They save into the same files as /music and /sounds, so I'll see them either way.
     - [ ] **Kaiju fight, redone**: your first take's tune at Punk Guy's tempo (152) with his drums and bass, a stomp in the fills. Its verdict is cleared for you to listen again (/music, or in a Peninsula fight).
     - [ ] The monitor's volume -/+ set the music, the sounds and the loops together, on the start screen, the avatar select, the picker and in every level (checked: 3 steps down took it from 10 to 7 of 16).
     - [ ] **Volumes per scene** (the Sound (dev) panel's bottom part, "Volumes here"): every sound heard in this scene, a row each (the theme, the loops, the sound effects): a slider 0 to 2 (1 as reviewed), saved for this scene as you move it and heard at once; ▶ on a sound effect plays it over and over (■ stops). A sound you've set in an earlier scene starts at that value in a new scene; one set nowhere at 1. ⚠ (hover for the numbers) marks a sound whose volume differs a lot (2x or more) between scenes; the list is also kept in `src/Game/DataClasses/soundVolumes.json` ("differences"). Scenes: each level (its walk and its fight apart), "start", "menu" and "landing".
3. A controls info modal with an image, for mobile and desktop, replacing the current pop-up.
4. Make the before-AI / after-AI video and upload it to YouTube.
5. README:
   > Claude (2026-11-25): a first draft is in [README-draft.md](README-draft.md), marked TODO where it needs you (links, GIFs, credits for art, fonts and sounds). It also notes there's no LICENSE file in the repo, though the old README links one. When you're happy with it, it replaces README.md.
   - credits and attribution;
   - the project synopsis;
   - the tools built during development and what each solved;
   - the before/after YouTube link and the trailer link;
   - a link to the commit showing the game before AI;
   - images and GIFs.
6. In-game credits: a final pass after sounds and all game data are in.
7. Remove old files.
   > Claude (2026-11-25): the audit is in [OLD-FILES.md](OLD-FILES.md): 7 source files and about 16 MB of images nothing uses (which the loaders preload today). Tick the ones to remove there; nothing's been deleted.
8. Match the window picture's little monitor to the Kaiju-Vision.
   > Claude: not yet placed in Jamie's order.
   > Jamie: please clairfy above question/request/statement... the main monitor is no longer "Kaiju-Vision" but the item is "8" in the order
   > Claude: thanks, it's #8. The item is about the small monitor you see through the apartment's window in the landing zoom picture (2-window.png): it should match the game's main monitor. Its original problem (a white casing there, black in the game) is likely already gone: on 2026-11-25 the window's inside was replaced with the relit apartment, whose monitor is dark. What's left is matching the shape, and the main monitor's casing is about to change in the casing ticket (thicker borders, grilles, volume buttons). Suggest: keep #8, and do it once the casing redesign is final. OK?
   > Jamie: Ok, sounds great.

### STRETCH
- A photorealistic landing page (Jamie, 2026-11-28; its own branch). Redo the landing in a photorealistic style, keeping the current scene layout (the Peninsula, the water, the Kaiju, the city lights, the moon).
  > Claude: the scene is code-drawn pixel art in layers now. A photoreal version would most likely be made images (generated or painted) set into the same layers, with the code-driven parts (traffic, lights, buoys, the sea Kaiju) restyled to match. A test of one layer would show what it takes before the rest.
- Player hand and drink obstacle (desktop only):
  - The hand drums on the desk; every 2–5 minutes of game time it sips coffee for 5–7 s, blocking part of the view.
  - It only happens while Pause is enabled (fights), and pausing beats it: the sip runs on real time, so it finishes while the game is paused.
  - With a warning before it starts, partial cover, never in the hardest moments, and an off option.
  > Claude: open question: if the player pauses during the warning, does the sip still happen during the pause, or is it skipped?
  > Jamie: yes, sip / hand movement is not main monitor "game content." It cannot be paused by pausing the game on the main monitor. If game content transitions to an unpausible section (like during cutscene, dialogue, or walking scene)... delay transition(?) until sip is complete (do not show "Paused" or anything, just stall the game until sip no longer blocks screen...) user should not notice due to screen being blocked.
  > Claude: got it, noted for the build: the sip is apartment content, so pausing never stops it; a sip that starts always finishes. If the game reaches a part that can't pause (a cutscene, dialogue, a walking scene) during a sip, the game quietly holds just before it, with no "Paused" shown, until the mug is down and the screen is clear.

### SHELVED
- The trained NPC AI.
- Ghost Girl's ghostly comeback.
- The settings and ability editor.
- Editor links.
- A chunkier monitor stand and border.
- The ability picker's yellow circuit background.
- Refresh the dialogue viewer summaries.

### Other open lists
- Flaky tests (found 2026-11-28): the full test run fails a different test on some runs (the full match, the Mermaid's stairway, the final fight's Kaiju), on the commit before the mobile work too (e62581a); each passes alone. They lean on random rolls and the run's timing. Worth making steady (seeded randomness) at some point.
- Multiplayer playtests 2–4. Playtest 2 has 4 questions for Jamie: heal, ragdoll layer, New Match label, turned Kaiju.
- Review the dialogue polish in /dialogue (MEDIUM).

---

## Mobile feature checklist (`feature/mobile`): check once all steps are done

Jamie will playtest when all four steps are built. Everything that needs checking on a phone goes here.

### The steps
1. Touch mode, the full-screen game, the touch HUD. **Built** (plus mobile playtest 1, below).
2. The screens before a level, on touch. **Built** (checks below). Jamie's spec (2026-11-28):
   - **Start screen**: on a phone, PLAY goes straight on to single player: no mode screen (no Multiplayer yet; Settings there is only for unlocks). An iPad keeps the mode screen (Jamie). **Built.**
   - **Avatar select**: the main monitor's content; behind the tanks, in the middle of the scene, the Agent's side-monitor content, as if on a screen behind and between the two characters; no side console content; tapping a character goes on to the next screen.
   - **Power picker** (from avatar select): the Agent's dialogue panel on the right (as the Street's talk), the picker on the left. Fewer than 3 picked: the Agent says "Pick 3 abilities" (no Stompy). One button at the panel's foot, colored as Recruit/Terminate: "BACK" until 3 are picked, then "PLAY".
   - **Power picker in the Lab**: the same screen. One button: "CANCEL" (red, as Terminate) while nothing has changed, or while changed but fewer than 3 picked; "CONFIRM" (green) once 1+ is different and 3 are picked. The one button fades between the colors, and new words type in letter by letter.
   - **Color vat**: the Agent's panel, "Choose your color"; the same CANCEL/CONFIRM button. The color picker in its own window, a third over the monitor's content and two thirds over the panel, above the button, clear of the hanging avatar, the vat's drips, the Agent's words and the button. No picker buttons or hex field: just the hue strip and the color square, big enough to use. Then (Jamie, ok'd): the picker entirely inside the panel, between the Agent's words and the button, the panel widened to about 45% on this screen only, so it never covers the avatar or the drips.
   - **Menu**: no Controls button on touch. **Built.**
   - **Avatar select to the picker** (desktop too, Jamie: yes): the labels' flash 0.9 s (was 1.5), the slide 0.6 s (was 1.1), so the picker comes up by 1.5 s. **Built.**
3. Placement tool and per-device tuning (**built**, checks below): four presets by screen size, not by brand (Jamie, 2026-11-28: yes): small phone (landscape height under ~380 px), standard phone (~380–415), large phone (~416–460), tablet (600+), each checked against the devices people actually use today; playWindow.json gets a section per preset. The iPhone SE's 16:9 gets a look of its own.
4. Polish (tap to start, performance, the final fight's extra powers, anything left). **Built** (checks below).

### Step 4, built: please check
- [ ] **"[Tap to start]"** on the landing on a touch screen (was "[Press any key]"); a tap starts it.
- [ ] **The final fight's Kaiju**: all ten powers on touch: the usual three, and the other seven as a row of smaller buttons across the top right. Is the row fine, or should they sit differently (an arc round the three, a column down the right edge)? Place HUD's "Extra powers" moves and sizes the row.
- Performance: done in mobile playtest 1's fixes (the tile icons, one draw a frame, the idle explosion canvas, the lighter glass). Test it on `npm run phone` (the built game), which skips React's slow development mode.
- Known, left as they are: on a phone the avatar select and the picker leave thin dark bands at their sides (their scene is drawn for a 16:9 screen; a phone is wider); cutscenes' whole-scene shots leave black at the sides for the same reason. Say if either bothers you on the phone.

### Step 3, built: please check
- [ ] **The four sizes**: small phone (short side under 380 px: the 360 Androids, iPhone mini/SE/X at 375), standard phone (380-410: iPhone 12-17, most Androids at 384-393), large phone (411-599: iPhone XR/11 at 414, the most common phone screen; Plus/Air/Pro Max at 420-440; big Androids at 412), tablet (600 up: iPads). From StatCounter's mid-2026 figures (414x896, 360x800, 390x844, 393x873, 384x832 and 375x812 lead) and this year's iPhone sizes. The menu's **Size** picks one by hand to see it on any screen ("Auto" goes by the screen).
- [ ] **Place HUD** (in the touch menu, in a fight): the game holds with its scene still showing, and each part of the HUD gets a handle (Stick, Powers, Passives, Health, Menu, Objective, Extra powers: three dashed circles where a Kaiju's extra powers go). Drag a handle to move that part; - and + size the chosen one; Reset puts it back. **Zoom** (the camera's closest, as the smallest tile in px: lower shows more) and **Panel** (the dialogue panel's width) for this size too. **Move bar** shifts the bar to the top, middle or bottom, out of the way. **Save** writes it into the game (Touch/touchTuning.json) when the phone is on `npm run dev -- --host`; on `npm run phone` it's kept on that phone only, and says so. Each layout (1-4) keeps its own placement per size.
- [ ] **Tablets** start with the HUD at 0.6x (its sizes go by the screen's height, so on an iPad it was far bigger than a thumb needs). On a 4:3 iPad the camera can show past the Peninsula map's bottom-left corner: worth raising the tablet's Zoom in Place HUD.
- Note: playWindow.json's "section per device" (a note from before) isn't needed: on touch there's no monitor window; each size's tuning is in touchTuning.json instead.

### Step 2, built: please check
- [ ] **The intro** (Jamie, 2026-11-28): tap the landing; the zoom ends in the apartment on the computer's live screen (as on a desktop); PLAY presses itself; the avatar select opens on the computer and its lights come on; then a quick fade from black to the phone layout. No taps count until the cut. Tuning: `TOUCH_INTRO` in Utils/device.js (PLAY after 1.1 s; the avatar select held 6.2 s; the cut 0.45 s).
- [ ] **Start screen**: on a phone, no mode screen (straight on to single player); an iPad keeps it.
- [ ] **Avatar select**: the whole screen; the Agent's screen (his "who are you", the chosen one's file) behind and between the two characters; no side monitor or console; tapping a character goes on.
- [ ] **Avatar select to the picker**: by 1.5 s now (labels 0.9 s, slide 0.6 s), desktop too.
- [ ] **Power picker**: the picker on the left, the Agent's panel on the right: "Pick 3 abilities." while fewer are picked. The button: BACK (red) until three, then PLAY (green); it fades between the colors and types the new word in. The pendants 1.7x bigger, no key numbers. **Your call:** with three picked the Agent says "Ready when you are." (my line, as a stand-in: change it or say none).
- [ ] **Power picker from the Lab**: CANCEL (red) while nothing's changed, or changed with fewer than three; CONFIRM (green) once one or more differs and three are picked. CANCEL puts the old powers back.
- [ ] **Color vat (the Lab's)**: the Agent's panel wider (45%), "Choose your color."; the color square and a thick hue strip inside it between his words and the button; no title, no hex field. CANCEL until the color changes, then CONFIRM, which dunks them and goes back (the button greys out during the dunk).
- [ ] **Menu**: no Controls on touch.
- **Open question**: the powers' details (what each does, "Recommended") were on the side monitor; on a phone they're nowhere now. Show the tapped power's details in the Agent's panel? (asked in chat)
- Known: the avatar select and the picker don't quite fill a phone's width (thin dark bands at the sides): step 3's tuning.

### Step 1, still open
- [ ] HUD layouts: menu > HUD: 1, 2, 3 (your mock-ups) and 4 (Claude's thumb arc). Which feels right?
- [ ] A Kaiju's powers past three (final fight): a row of smaller buttons across the top right.

### Mobile playtest 1 (2026-11-28, iPhone): built

**First, test with the fast build.** The dev server (`npm run dev`) runs React's slow development mode; on the phone that was a big part of the slowdown. Run `npm run phone` (it builds, then serves the build on your network) and open the Network address it prints, adding `?tune` once (e.g. `http://192.168.x.x:4173/?tune`) so the HUD and Device switches stay in the menu. `npm run dev -- --host` still works for quick looks.

- [ ] **M6, M18, M21. Tile statuses and the frame rate** (your biggest concern).
  - The statuses weren't really duplicating. Measured on the same fight, the game spreads them the same on the phone as on the PC. What you saw: each power icon leaves a fading "ghost" where it was, and at a low frame rate those ghosts pile up, so it looks like 3 rows of fire and denser lightning.
  - The slowdown: every status icon was drawn as glowing text with a canvas blur, on every frame, and twice in one frame while ghosts faded. iPhones are slow at canvas blur. Now each icon is drawn once and copied, and the tiles redraw at most once a frame.
  - Also: the HUD explosions' full-screen canvas no longer clears itself every frame when nothing is exploding; the small touch pieces (capsules, passives, knob) no longer blur the game behind them (the stick, the powers and the menu still do).
  - If it still drags, tell me where (which scene, how many statuses) and I'll keep going.
- [ ] **M17. Train station shake**: off on touch screens.
- [ ] **M1. The HUD and Device selects** now open on iPhone (a click handler took the focus off them, which closed the picker).
- [ ] **M25. Music on iPhone.** The ring/silent switch mutes web sound on iPhones unless the page asks for "playback" sound; Spellcraft plays an `<audio>` file, which does that, so this game's sound came on after it. The game now asks for playback (and on older iOS plays a silent loop to do the same), and retries starting sound on each tap.
- [ ] **M2. The landing's left and right Kaiju**: their purple outline moved onto a holder outside the waterline cut, where Safari had dropped it.
- [ ] **M3. Radio call**: the radar in its own window on the left beside the panel, as the Street's talk, centered on the Peninsula.
- [ ] **M4. Dialogue text** about twice the size (1.9x) on touch: names and words.
- [ ] **M14. Continue**: the panel's whole width at its foot, taller, bigger text; no "[ENTER]" on touch (no keyboard).
- [ ] **M23. Recruit / Terminate**: much taller on touch; no key numbers.
- [ ] **M24. After the choice**: the panel goes at once and the result plays full screen.
- [ ] **M13, M22. Objective**: no longer runs across. Each letter condenses out of a puff of smoke (middle first), holds a beat, then drifts up and apart. Every 7 s; tune `TICKER` in Touch/touchLayouts.js. Shown only while you're in control: not during dialogue, cutscenes, the choice, the Lab's screens or the end (your note).
- [ ] **M20. The dots** on the power buttons are gone.
- **M5. Teleport zoom**: undone at your request (the camera still zooms in close near your own Teleport's wormholes, as before). Nothing to check.
- [ ] **M9, M10, M15, M19. Touch camera**:
  - Wider: the touch minimum tile size was 50 px (set for tapping tiles, which we dropped for the joystick); now 30. That covers the walking Peninsula too.
  - The player is kept near the middle, a little above it (clear of the stick and buttons along the bottom), with more room round the player and the Kaiju, less lean toward the Kaiju, and the zoom changing at less than half the speed, so it shouldn't bump about. Tuning: `CAMERA.touch` in DataClasses/Camera.ts.
- [ ] **M7. Street exit sign** raised clear of the stick on touch.
- [ ] **M16. Location carets** on touch: one fixed, smaller size; each site's icon in a round frame like the incoming Kaiju badges; its word above or below the circle. (Desktop unchanged; say if you want it there too.)
- [ ] **M8. The teammate's "Heads-up" balloon** pointed at the player: it was aimed at her planned stop, and spacing moves her a tile over. It's placed from where she actually stands now (desktop too).
- [ ] **M11. Blurry avatars on the Street's first load**: the loader now fully decodes the sprite sheets and keeps them, so the phone doesn't decode them the first time they're shown. Not something I can see headless: tell me if it still happens.
- [ ] **M12. Tiles over the avatars** while walking: not in desktop browsers, so it looks like Safari's layer order; on touch each avatar is its own layer now, which Safari keeps above the tiles. Also not checkable headless: tell me if it still happens.

## Misc fixes (2026-11-27): please check

- [ ] **Misc1. The room's camera pan over the side content.** Mousing over (or near) the side monitor and the console no longer pans the room on the avatar select, the power picker and the color vat. It goes back to its usual place there; the bands past them, at the window's edge, still pan. The dev panel is the same.
- [ ] **Misc2. The landing zoom.**
  - The far-left strip: the room's push showed the pictures before it (the window's) down the left edge, where the room doesn't reach on a wide window. Now they're hidden once the room has taken over, and its edges fade to dark, as the game page's room does.
  - The slowdown: not dropped frames (measured headless: steady). The zoom's own pace dipped. The city's push sped up, then slowed into the window shot, whose pace was slower. The window shot is now quicker (1.2 s to 0.7 s), so the city only ever speeds up into it, and the room's push starts at the window's pace. If it still seems to slow on your machine, tell me and I'll measure it there.
  - **Reminder (you asked):** look the whole zoom over for any other issues.
- [ ] **Misc3. Your sound and music notes.**
  - Passives: silent everywhere (the cast and the passive sounded together). The sounds are kept: `IS_PASSIVE_SFX_ON` in GameBoardPieceAbility.js, set to `true`, brings them back.
  - Title theme, redone to be dramatic: slower (92), huge held chords, a heroic tune with wide leaps over a low brass line, timpani-like toms rolling into crashes. Listen at /music or on the start screen.
  - Avatar select: no music while the lights and the tanks come up; the Sleazy Agent's theme starts as he shows on the side monitor, and plays on through the picker and the vat. (The calm "menu" theme isn't used now.) Should the picker and the vat have their own music, or keep his?
- [ ] **Misc4. The coffee's steam** rises in front of the side monitor and console now; the mug stays where it is. (On the game page; in the landing's zoom it stays in the room picture, behind nothing.)
- [ ] **Misc5. The start screen's cascade: Kaiju, not 1s and 0s.** Flat neon Kaiju silhouettes (Stompy's sprite sheet, each frame trimmed to its figure): at each column's head, random frames flash bright; the one showing as the head moves on burns into that spot, purple, and fades there as a phantom. Then, as you asked: larger (22 columns, was 33), more cascades (two falling in each column at once, and back sooner), a third slower, and the trails fade all the way to black (no faint ghosts left). Then only the Kaiju walking toward you (down the screen): at each head its walk steps on in order, no random poses.
- [ ] **Misc6. The room's look-about pulls back too.** With the mouse in an edge band (where it pans), the view also zooms out, slowly, building speed as the pan does (about 3 s all the way), as far as the apartment picture still covers the window; it eases back in as the mouse leaves the band. The further into the band, the further out. All the way out, the whole picture shows, so there's no more to pan. Over the side content (Misc1) it doesn't zoom either. Tuning: `CAMERA_TUNING.zoomOut` in Utils/camera.js. Then, as you asked: the room's edges darken to black (about the outer 9% across, 8% down) before they fade out, and past them is pure black (was a dark grey, #0b0c0e, that read as a color); the things in front of the monitor fade out over the same edges. Tuning: `ROOM_EDGE_DARK` in Components/RoomScene.jsx.

- [ ] **Misc7. The coffee's steam** fades out over the top third of its box as it rises, rather than being cut off at the box's edge (Jamie, 2026-11-28). In the room and in the landing's zoom. Tuning: `STEAM.topFade` in Components/RoomScene.jsx.

## Playtest 41 (2026-11-25 evening): your chat list and your notes above

### Built: please check
- [X] Start screen: "Single Player" fits inside its button (Chrome). The column of buttons now grows to the longest name.
- [ ] Big notices ("Defeat Ghost Girl", "Gained +1 temporary health point", objectives) fit inside the screen, centred: no more running onto the border to the right. Cause: they were sized to the whole game frame, which is wider than the screen since the casing grew.
- [ ] Recruit battle's end cards ("Punk Guy recruited!", "Rapid Transit Station unlocked"): lower, still at the right.
- [ ] Lab computer's code cards (after a code like KAIJU): as big as the game's own unlock card, never squeezed; as many per batch as fit the screen, batch after batch; a smaller indent on the right. Cause: their height was a share of the browser window, not the screen, so a full batch got squashed.
- [ ] Power picker: "3/3" closer to the left edge.
- [ ] Subway: after the Punk touches the eye, the shot is centred on him where he ends up (it was aimed where he stood before his scoot to the eye).
- [ ] Subway: the teammate brings Teleport when you didn't pick it (in place of their third power).
- [ ] Subway: with a train in, a teammate on a different platform from the Punk teleports over when their Teleport is ready: beside you if you're on his platform, else near him.
- [ ] Fire on the Punk: the first hit on him now shows its "-1" and shake. See the note.
  > Claude: the earlier check (playtest 34) missed this. The Punk's Overgrowth passive gives him +1 bonus health. The first hit takes that point, and his bar, the "-1" and the shake all followed only his base health, so the hit looked like a miss. Fire is often the first thing to reach him. Fixed: hits on bonus health now show. Also by design: his Aegis (Metal) shield tiles block Fire (Shield ranks above Fire when they meet), so Fire into his shield does nothing. Tell me if you'd rather Fire burned through Aegis.
- [ ] Ghosts after the player (Haunt's, the Rooftop ring's): the same tight, quick zoom as the sea creatures.
- [ ] Re-centring: in walking scenes the monitor centres 1 s after the side things go (just long enough for them to fly off). Before a fight, while its opening scene plays, it stays aside, because the HUDs come next. Other cases keep the 5 s.
- [ ] Lab computer: no post-it (the password stays as the easter egg). The VACATION key hint says "files", not "photos".
- [ ] Colour vat: "Pick Your Color" bigger (3.5, was 2.9) and higher. Tell me if it's too close to the edges.

### Built 2026-11-25 (late), from your answers: please check
- [ ] **Quit in a game** (anywhere past the start screen: the avatar select, the picker, a fight, a walk): the monitor switches off, then comes back on to its start screen (PLAY). The game starts afresh: nothing chosen is kept; the unlocks stay.
- [ ] **Quit on the start screen** goes back to the landing:
  - the monitor switches off where it stands, with no more pull-back of the live monitor;
  - the room's picture (its own monitor in it) takes over;
  - its whole ~5 s push runs backwards, then the window and the city.
- [ ] Back in after that: the monitor boots to its start screen (it went straight to the avatar select).
- [ ] Back on the landing, the walking Kaiju no longer shows at full size over the zoomed-in city. It waits till the skyline has zoomed back out, then starts its walk, fading in at the left.
- [ ] **Settings → Lab computer** looks like the walking Lab's: the window, sill, wall and mug, no clock or post-it. Settings keeps its short menu.
- [ ] **Night** behind the Lab computer: from Settings always, and from the walking Lab before the trap. Other times it's day, as before.
- [ ] **Eye cursor** in both Lab computer views: over the desk and the Lab monitor's casing; the normal pointer over its screen.
- [ ] **Avatar select / picker focus:**
  - Switching screens (either way) lets go of the focus: nothing blinks on arrival, unless Play is ready.
  - Picking the third power focuses Play (Back let go).
  - Arrowing to Back: only Back blinks; Play stays lit, still.
  - The words' blink and the rings' pulse run on one clock, in sync.
  - Back to the avatars and forward again with 3 picked: Play focused and blinking.
- [ ] **Radar:** the East Bay's hex coastline follows your yellow pen: down the right edge from the right bridge, bowing out, curving back in at the bottom. The land to its right goes on off the screen. Fine-tune it in the level editor (Edit tiles, radar) if needed.
- [ ] **The Agent's ASCII art:** the files are .TXT, shown with TYPE (DOS's command for showing a text file), each signed `-A. '84` in its bottom-right corner.
- [ ] **Teammate and recruit range** (recruit battles with one opponent: the Subway, Rooftop and Aquarium fights, training and sparring):
  - Allies keep to your section (platform, roof or floor) and within a radius of you.
  - The radius is everything on your screen while the opponent is on screen, shrinking to 5 tiles by the time they're twice that far away.
  - Allies' Teleports land inside it too.
  - In the Subway, the teammate teleports over to your platform when a train has you apart.
  - **On the attack:** you and the teammate on one platform, Punk Guy cut off on another by the train: the teammate teleports beside him, and the portal it leaves by you stays open (~6 s) for you to follow through. It's off the leash while that portal's open; once you're through (or it shuts), the leash is back.
  - The last hit can still be anyone's, as you said.

### Still open from playtests 39 + 40
- [ ] Unlock cards at the right, unless they'd cover "Back to map".
- [ ] Plain Kaiju never take Teleport portals.
- [ ] Respawned Kaiju show no Spurned icon.
- [ ] Final fight: the teammate turned Kaiju doesn't get stuck at your Teleport link.
- [ ] Final fight: lose, then Retry: it starts at the turn spots.
- [ ] Final fight: recruits turn, and "You destroyed the city!" shows.
- [ ] Finale: "Unlock code: KAIJU" at the top centre.
- [ ] Sewer 1 with 0 recruits and with 1 recruit.
- [ ] Aquarium upstairs: no pan-in toward the ground floor's stairs.
- [ ] Aquarium: the camera looks toward portals and stairs within 5 tiles, with the close zoom.
- [ ] Aquarium Worker portraits: no white between her arms and body.
- [ ] Charmed on the stairs: tell Claude which stairs and what was happening if it happens again.

(Your ticked items from playtests 39 + 40 are in [DONE.md](DONE.md).)

---

## Done
Moved to [DONE.md](DONE.md).
