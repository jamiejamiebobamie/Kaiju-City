# Kaiju City: backlog and playtest checklist

A shared list between Jamie and Claude. Claude reads it at the start of each session and keeps it up to date.

**How to use it**
- Tick a checklist box when an item is confirmed: `- [x]`.
- To comment, reply or ask, write an indented line under the item, starting with your name:
  - `> Jamie: ...` for Jamie's notes.
  - `> Claude: ...` for Claude's answers.
- New items can go anywhere. Claude will sort them into place and ask about anything unclear.
- Once Jamie marks an item done, Claude moves it to [DONE.md](DONE.md), into its section there (newest at the top).

Last updated: 2026-11-25 (evening).

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
3. Tab icon (favicon):
   - The roaring right-hand landing Kaiju (facing left, silhouette) with the purple lo-fi fire mid-spew.
   - A tool for it: a static mid-spew Kaiju and fire; rescale and place both; a framing circle Jamie sizes and places; an inner circle where a fade starts, fully clear by the outer circle; export.
   - Then Claude makes the icon set as for SpellCraft (../QuickCast): favicon.ico (16/32/48), favicon-32, apple-touch 180, icon-192, icon-512, a webmanifest, loaded with the first loader.
   > Claude (2026-11-25): the tool is built: open `localhost:5180/icon` (dev server). Pick Kaiju, Fire or Circle; drag to move, mouse wheel to scale; sliders for everything. Previews at 16, 32, 48 (on a dark tab, a light tab and clear) and 180. **Save** keeps your settings (iconTool.json); **Export 1024 px** downloads the image and writes it to `public/icon-source/kaiju-icon.png`. When you're happy with it, tell me and I'll run `scripts/makeIcons.py` (ready) to make the icon set and add the tags to index.html.
   > Claude (2026-11-25): made from your final export: favicon.ico (16, 32, 48), favicon-32.png, apple-touch-icon.png (180), icon-192.png, icon-512.png and site.webmanifest in `public/`, and the tags in index.html. Tick this item when you've seen it in the tab and I'll move it to DONE.md.

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
- Multiplayer playtests 2–4. Playtest 2 has 4 questions for Jamie: heal, ragdoll layer, New Match label, turned Kaiju.
- Review the dialogue polish in /dialogue (MEDIUM).

---

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
