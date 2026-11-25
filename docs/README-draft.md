<!--
  README draft (Claude, 2026-11-25), for Jamie to review before it replaces README.md.
  Lines marked TODO need Jamie's input (links, images, wording). Facts are from the code and the project's history;
  please correct anything that reads wrong.
-->

# Kaiju City

A pixel-art action game in the browser: you're sitting at your desk at night, playing a game on an old 90s monitor,
and the game inside it is a city under attack by kaiju. Pick an avatar and three powers, defend the Peninsula, recruit
the people you beat, and find out what's really going on at the Lab.

<!-- TODO: trailer link, and a hero GIF of the landing zoom into the apartment and onto the monitor -->
**Trailer:** TODO
**Before AI / after AI:** TODO (YouTube)

![TODO: a screenshot or GIF of a fight on the Peninsula](docs/images/TODO-fight.gif)

## The game

- **A computer inside a computer.** The landing page zooms through a window into a small apartment; the game runs on
  the "monitor" in that room, with a side monitor, a console and drone-like HUDs around it. The camera looks around
  the room with the mouse, and the room has its own life (a flickering black light, a steaming coffee, a clock
  blinking 12:00).
- **Campaign.** A story told through radio calls, dialogue and walking scenes: the Peninsula's fights, then the Street,
  the Subway, the Rooftop Cemetery, the Aquarium, the Lab, the Sewers, and a final battle where your teammate turns.
- **Powers and classes.** Pick three of the powers (among them Wildfire, Ice Slice, Discharge, Aegis, Dispel, Charm,
  Haunt, Overgrowth, Heal, Flood, Tidal Wave, Phase Ghost and Escape/Teleport); every combination is a named class.
  Powers leave statuses on the hex tiles (fire, ice, water, ghosts, sea creatures...) that interact, so fights play
  out differently each time.
- **Recruits.** Bosses you beat can be recruited or terminated; recruits join you, can be trained, and can die for good.
- **Bosses.** Phased boss fights: a scream-teleporting ghost on the Rooftop, a flooding Aquarium with the Mermaid
  healing upstairs, the Agent in the Lab.
- **Multiplayer.** Co-op campaign and versus matches over a peer-to-peer link (PeerJS): share a join link, no server.
- **Unlocks.** Codes and wins unlock powers, characters and modes.

<!-- TODO: a short GIF each: the power picker, a boss fight, the radar call, multiplayer -->

## Play it

<!-- TODO: the deployed link, once it's live again -->
TODO: link

Or run it locally:

1. Install [Node.js](https://nodejs.org/) (it includes npm).
2. Clone the repo, then in its folder:
   ```
   npm install
   npm run dev
   ```
3. Open the address it prints (http://localhost:5173 by default).

Other commands: `npm test` (the game's tests, vitest), `npm run typecheck`, `npm run build`.

## How it was made

Jamie started Kaiju City solo (React, a top-down board, simple AI and AI-generated art) and in late 2026 kept
building it with Claude (Anthropic's AI) as a pair programmer. The game before AI help is kept as tags:

- `before-claude-master` (2026-06-05): the last playable version before AI help.
- `before-claude` (2026-08-15): Jamie's last commit before working with Claude (mid-refactor).

<!-- TODO: link the tags on GitHub, e.g. https://github.com/jamiejamiebobamie/Kaiju-City/tree/before-claude-master -->

**Before AI / after AI video:** TODO (YouTube)

### Tools built along the way

Much of the work was building small tools so the game could be tuned by eye rather than by numbers in code. All are
dev-only (they run with `npm run dev`).

| Tool | Where | What it solved |
| --- | --- | --- |
| Tile editor | in game, dev panel: "Edit tiles" | Painting each level's walkable tiles, spawn and goal tiles, links (stairs, portals) and the radar's outline over the level art. |
| Level editor | `/level-editor` | Starting a new level: loading its scene picture and lining the hex grid up over it, saved straight into the repo. |
| Dialogue viewer | `/dialogue` | Reading the whole story in order, editing lines, and approving or reverting a polish pass line by line. |
| Class review | `/classes` | Naming every power combination (165 classes): cycle through them, pick from suggested names, save. |
| Landing tuner | the landing page with `?tune` | Placing the landing scene's Kaiju, fire, buoy and lights by sliders, live. |
| Window adjust | in game, dev panel: "Adjust window" | Sizing and placing the monitor's screen in the frame. |
| Apartment mock-up | `/apartment` | Arranging the room behind the monitor from cut-out parts, trying screen shapes, zoom and cameras, and exporting the layout the relit art was painted from. |
| Tab icon tool | `/icon` | Framing the roaring Kaiju for the browser tab icon, with previews at every icon size. |
| Image scripts | `scripts/*.py` | Cutting sprites and parts out of generated art, compositing relit pictures, extending art past its edges, making icon sets. |
| Screenshot runs | Edge headless (`scripts/apartmentCapture.mjs`, `scripts/layoutBaseline.mjs`) | Checking every screen at a fixed window size, before and after a change. |
| Asset manifest | `scripts/assetManifest.mjs` (runs before `dev` and `build`) | Every image and sound preloaded by the landing or game loader, so nothing pops in. |
| NPC training | `training/` (Python), `src/Game/DataClasses/npcBrain` | Experiments training the NPCs' behavior with reinforcement learning, exported to ONNX to run in the browser. |

<!-- TODO: a screenshot of each tool, or a GIF of the apartment mock-up and the dialogue viewer -->

## Tech

- React, TypeScript and styled-components; Vite; vitest for tests.
- Layout in container units (`cqw`) inside a 16:9 safe area, so the game scales to any window.
- Canvas for the tiles, effects and the radar; CSS for the monitor, HUDs and room.
- PeerJS for multiplayer; onnxruntime-web for the trained NPC model.

## Credits

**Made by** Jamie McCrory.

**Built with** Claude (Anthropic) as a coding partner.

<!-- TODO: art sources and tools (which image generators, which edits by hand), fonts (gameboy), sounds once added,
     any libraries or assets that ask for attribution, playtesters -->
- Art: TODO
- Fonts: TODO
- Sounds: TODO
- Libraries: React, styled-components, Vite, PeerJS, onnxruntime-web (see package.json).
- Thanks: TODO

## License

MIT. <!-- TODO: the old README links LICENSE.md, but there's no license file in the repo: add one (MIT text) or drop this section -->
