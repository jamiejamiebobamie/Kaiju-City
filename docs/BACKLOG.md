# Kaiju City: backlog and playtest checklist

A shared list between Jamie and Claude. Claude reads it at the start of each session and keeps it up to date.

**How to use it**
- Tick a checklist box when an item is confirmed: `- [x]`.
- To comment, reply or ask, write an indented line under the item, starting with your name:
  - `> Jamie: ...` for Jamie's notes.
  - `> Claude: ...` for Claude's answers.
- New items can go anywhere. Claude will sort them into place and ask about anything unclear.
- Once Jamie marks an item done, Claude moves it to [DONE.md](DONE.md), into its section there (newest at the top).

Last updated: 2026-11-25.

---

## Backlog

### HIGH
1. Run the combined playtest 39 + 40 checklist (below).
2. HUD drawing area too small: the HUDs get cut off on the right (and maybe the bottom) when they bob around and when they crash and burn. The right side is worth fixing; the bottom maybe not.
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

### LOW (Jamie's order, before merging to master)
1. Re-enable localStorage saves: one compressed save of all unlocks, maybe one-word codes read on load or on Play.
   > Claude: this is also listed under Shelved (Jamie said to move it there too). Which one?
   > Jamie: Woops! Sorry, we just want to implement so that it is clean / not saving a bunch of localstorage data to user's comp, and ensure the app is able to read it cleanly. the unlocked content should be done "intelligently" so that it adds to singleplayer/multiplayer experience w/o detracting from it. will need to discuss.
   > Jamie: please remove this one from "Shelved" section if repeated there.
   > Claude: done: removed from Shelved. Noted: a small, clean save that the app reads reliably, and unlocks designed to add to single player and multiplayer without taking away from either. We'll discuss the design before building it.
2. Sound system: 42 proposed effects waiting on Jamie's review. The volume buttons and bars exist for it (`VOLUME_LEVEL` in PlayWindow.jsx).
3. A controls info modal with an image, for mobile and desktop, replacing the current pop-up.
4. Make the before-AI / after-AI video and upload it to YouTube.
5. README:
   - credits and attribution;
   - the project synopsis;
   - the tools built during development and what each solved;
   - the before/after YouTube link and the trailer link;
   - a link to the commit showing the game before AI;
   - images and GIFs.
6. In-game credits: a final pass after sounds and all game data are in.
7. Remove old files.
8. Match the window picture's little monitor to the Kaiju-Vision.
   > Claude: not yet placed in Jamie's order.
   > Jamie: please clairfy above question/request/statement... the main monitor is no longer "Kaiju-Vision" but the item is "8" in the order
   > Claude: thanks, it's #8. The item is about the small monitor you see through the apartment's window in the landing zoom picture (2-window.png): it should match the game's main monitor. Its original problem (a white casing there, black in the game) is likely already gone: on 2026-11-25 the window's inside was replaced with the relit apartment, whose monitor is dark. What's left is matching the shape, and the main monitor's casing is about to change in the casing ticket (thicker borders, grilles, volume buttons). Suggest: keep #8, and do it once the casing redesign is final. OK?

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

## Checklist: playtests 39 + 40 and the 2026-11-25 changes, by view

### Landing / start screen
- [ ] The walking Kaiju goes farther out on the left, fully visible, like the right.
- [ ] No Gemini star in the zoom photos or the background corners; is the soft blur OK?
- [ ] The landing Kaiju's inner-arm lines are back to the original.

### Landing zoom into the apartment
- [ ] The wavy pixel steam over the mug.
- [ ] The black light stutters during the room push (stronger now).

### Apartment (any game screen)
- [ ] The black light flickers every 8–20 s and goes much darker, sometimes staying dead for a beat.
- [ ] The eye cursor over the room and the monitor border, including the window edges when panned. The normal cursor on the screen and the side things; the hand on buttons.
- [ ] "Not allowed" cursor on disabled buttons (the greyed Pause, side console, picker pendants).
- [ ] The camera follows the mouse in the side areas and glides home.
- [ ] Shaky cam on and off (dev panel).
- [ ] The monitor re-centres 5 s after nothing is beside it, but not during short gaps.
- [ ] The Kaiju Kola can stands in front of the casing's corner.

### Monitor casing (mock-up)
- [ ] Pause, Controls, Quit and the ticker are back at the top left; no "KAIJU-VISION".
- [ ] Thicker sides and bottom; the left border matches the right, with nothing cut off on any screen.
- [ ] Speaker grilles: parallel sides, outer side lower, 35° stepped bottom, even room above and below.
- [ ] Volume buttons: bottom left, clear of the can, centred in the border; flush ring with a crater; − and + the same size; worn, chipped print.
- [ ] Pressing − or + shows "VOLUME" and the green bars, higher and bigger, over everything on screen for about 2 s.

### Settings (start screen) → Lab computer
- [ ] Mouse near the screen's inside edges pans the desk; the shaky-cam bob shows.
- [ ] After a code opens something, the terminal closes back to the start screen.
- [ ] No post-it on the Settings monitor.

### Avatar select / power picker
- [ ] Side console: arrowing to "Back" makes its text blink with its rings; "Play" stays lit and still.
- [ ] Enter presses the pulsing button without arrowing first.
- [ ] Side monitor: the bio stays hidden while it switches to Stompy.
- [ ] Class battle: purple hologram Kaiju, explosions and fire tiles. Kaiju come every 1.8–3.6 s, up to 4.
- [ ] Play goes straight into the match (no "Wild Kaiju have appeared!" page).

### Walking Lab
- [ ] No pause: Pause is greyed out and Esc does nothing.
- [ ] After the power picker, the monitor re-centres about 5 s later.
- [ ] Unlock cards sit at the right.

### Walking Lab → Lab computer (key 2)
- [ ] The desk pans at the screen's edges, and the bob shows.
- [ ] The post-it: bigger, reads "password", slanted below the green light.
- [ ] Behind the computer: the window sill with the day Peninsula, no clock or poster, and the mug with steam.
- [ ] VACATION shows "1 of 4".

### Colour vat
- [ ] The avatar hangs fully in view, with the cable above its head.
- [ ] "Pick Your Color" is bigger and a little higher.

### Radar call
- [ ] The right bridge's outline runs out of the top-right corner instead of closing in a loop.

### Peninsula (fights, walking, speech bubbles, pre-battle)
- [ ] In the zoomed-out shots, the right bridge runs off the screen with no seam.
- [ ] "KAIJU TERMINATED" on one line; objective notices on one line where they fit.
- [ ] Unlock cards at the right, unless they'd cover "Back to map".
- [ ] HUD wires: current runs to the monitor, more of it as you cast more.
- [ ] Plain Kaiju never take Teleport portals.
- [ ] Respawned Kaiju show no Spurned icon.
- [ ] HUDs stay down after a training win.
- [ ] One recruit: "I'll hold them off!"

### Final fight
- [ ] The teammate turned Kaiju doesn't get stuck at your Teleport link.
- [ ] Lose, then Retry: it starts at the turn spots.
- [ ] Recruits turn, and "You destroyed the city!" shows.
- [ ] Finale: "Unlock code: KAIJU" at the top centre.

### Sewers
- [ ] Sewer 1 with 0 recruits and with 1 recruit.
- [ ] No pan-out before "What's that glow?"; the glow lights on that line.

### Aquarium
- [ ] Upstairs: no pan-in toward the ground floor's stairs.
- [ ] The camera looks toward portals and stairs within 5 tiles, with the close zoom.
- [ ] Aquarium Worker portraits: no white between her arms and body.
- [ ] Charmed on the stairs: tell Claude which stairs and what was happening if it happens again.

---

## Done
Moved to [DONE.md](DONE.md).
