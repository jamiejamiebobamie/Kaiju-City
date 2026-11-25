# Old files: what nothing uses any more

An audit for the backlog's LOW item "Remove old files" (Claude, 2026-11-25). **Nothing has been deleted.**
Tick the ones to remove (`- [x]`), or write `> Jamie: keep` under any to keep. Claude deletes only the ticked ones,
then checks the game and the tests.

How it was found: each source file was checked for anything importing it, and each file in `public/` for its name
anywhere in the code, scripts or index.html (the asset manifest left out, since it lists every file). Files the game
finds by a name it builds (like `god-rays-${n}.png`) were checked by hand and are in use (listed at the end).

**Worth knowing:** every file in `public/` is in the asset manifest, so the game's loaders **preload all of these
too**. The likely-unused images below come to about 16 MB of the first load; removing them makes the game load faster.

---

## Source files nothing imports

- [ ] `src/Components/FullscreenPage.jsx`: the old full-screen story page ("Wild Kaiju have appeared!"), removed from the game 2026-11-25.
- [ ] `src/Components/LandingFlash.jsx`: the landing's white flash, taken out 2026-11-19 (see LandingKaiju's comment).
- [ ] `src/Components/NavBar.jsx`: an old navigation bar.
- [ ] `src/Components/SkyLineSVG.jsx`: an SVG skyline.
- [ ] `src/Game/ReactComponents/AvatarRoster.jsx`: an older avatar roster.
- [ ] `src/Game/ReactComponents/UI/DescriptionDisplay.jsx`: an old description panel.
- [ ] `src/Tutorial/Components/Abilities.jsx`: from the old tutorial.

(Used only by tests, so they stay: `src/Game/DataClasses/testHelpers.js`, `src/Game/DataClasses/npcBrain/TrainingEnv.ts`.)

## Images nothing uses

### Old story pages (about 6.4 MB)
- [ ] `public/story_images/match_start.png` (the removed "Wild Kaiju" page's picture)
- [ ] `public/story_images/match_won.png`
- [ ] `public/story_images/match_lost.png`
- [ ] `public/story_images/tutorial_exit.png`
- [ ] `public/story_images/tutorial_kaiju_warrior.png`

### Sprite sheet originals and tests (about 7.5 MB)
- [ ] `public/spritesheet/_ORIGINALS/` (4 files: `image_35222755.png`, `image_82d584fb.png`, `image_972e5d91.png`, `player1.png`), the generated sources the sheets were cut from. *Maybe keep them outside `public/` instead (so they aren't shipped or preloaded).*
- [ ] `public/spritesheet/kaiju_sprite_FIRE2.png` (2.5 MB; the game uses `kaiju_sprite_FIRE1.png`)
- [ ] `public/spritesheet/hazmat-broom.png` (the sweepers use `levels/npcs/hazmatBroomLeft/Right.png`)
- [ ] `public/spritesheet/passiveAbilityActivationSprite_TEST.png`

### The old game UI (about 1.1 MB)
- [ ] `public/GameUI_Pieces/GameArea_Background.png`, `GameArea_Overlay.png`
- [ ] `public/GameUI_Pieces/ScoreArea_Background.png`, `ScoreArea_Overlay.png`
- [ ] `public/GameUI_Pieces/HolographGrid1.png` to `HolographGrid4.png`
- [ ] `public/GameUI_Pieces/modifiers_ui/` (8 files: `1-mod` to `4-mod`, `1-noMod` to `4-noMod`)
- [ ] `public/circuit-board.png`

### Old logos
- [ ] `public/logo1.png`
- [ ] `public/staticLogo.png`

### Zoom scene originals (about 0.9 MB)
- [ ] `public/zoom-scene/image_14507287.jpg`, `image_3426ed31.jpg`, `image_6ab20372.jpg`: generated originals; the zoom uses the numbered pictures. *Maybe keep outside `public/`.*

### NPC poses no level places
- [ ] `public/levels/npcs/mohawkFront.png`, `mohawkFrontAlt.png`, `mohawkBack.png`
- [ ] `public/levels/npcs/blackFemaleBack.png`
- [ ] `public/levels/npcs/hazmatFront.png`, `hazmatLeft.png`

---

## Checked by hand: in use (keep)

These came up in the name search but the game builds their names:
- `public/levels/aquarium/glass/*` and `rays/*` (the Aquarium's breaking glass and light rays)
- `public/levels/rapidTransit/god-rays-*`, `train-enter*`, `train-exit*`, `train-loop*` (the Subway)
- `public/levels/portraits/hud-*` (the HUD portraits)
- `public/levels/sewer2/*-spritesheet.png` (Sewer 2's Kaiju parts)
- `public/levels/street/*-glow.png` (the Street's glowing parts)
