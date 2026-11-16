/*
  The HUD, in one place (Jamie, 2026-11-16: the HUD rebuilt so everything about it is easy to change).

  A HUD is its console art (a metal plate, two pictures: the plate behind, and the overlay in front with holes in it),
  and the things that show through the holes: the portrait, the health, the three powers and their keys, the three
  passives. Everything is placed in the art's own pixels, on the holes measured from the overlay picture, so it all
  sits in the metal exactly; the whole HUD is then scaled to its size on screen.

  To change something:
  - a part's place or size: its box in PLATES (x, y, width, height, in the art's pixels);
  - what draws on top of what: HUD_LAYERS (one list, bottom to top);
  - a HUD's size on screen: HUD_VARIANTS (the player's, a teammate's, a compact one for a crowd);
  - colors and effects: HUD_LOOK.
*/

// the console art and its holes (measured from the overlay pictures: where they're see-through)
export const PLATES = {
  player: {
    back: "/GameUI_Pieces/PlayerArea_Background.png",
    front: "/GameUI_Pieces/PlayerArea_Overlay.png",
    width: 483,
    height: 215,
    health: { x: 23, y: 27, width: 255, height: 26 },
    portrait: { x: 313, y: 43, width: 138, height: 138 },
    actives: [
      { x: 36, y: 107, width: 56, height: 55 },
      { x: 110, y: 107, width: 54, height: 54 },
      { x: 184, y: 109, width: 54, height: 52 }
    ],
    keys: [
      { x: 79, y: 144, width: 21, height: 21 },
      { x: 153, y: 145, width: 21, height: 20 },
      { x: 226, y: 144, width: 21, height: 21 }
    ],
    // the three small sockets arcing over the portrait, left to right
    passives: [
      { x: 296, y: 36, width: 24, height: 25 },
      { x: 322, y: 16, width: 24, height: 25 },
      { x: 352, y: 7, width: 25, height: 25 }
    ]
  },
  teammate: {
    back: "/GameUI_Pieces/TeammateArea_Background.png",
    front: "/GameUI_Pieces/TeammateArea_Overlay.png",
    width: 355,
    height: 162,
    health: { x: 16, y: 120, width: 191, height: 21 },
    portrait: { x: 234, y: 33, width: 98, height: 98 },
    actives: [
      { x: 24, y: 37, width: 41, height: 40 },
      { x: 80, y: 37, width: 41, height: 40 },
      { x: 135, y: 37, width: 41, height: 40 }
    ],
    keys: [
      { x: 57, y: 65, width: 15, height: 14 },
      { x: 112, y: 65, width: 15, height: 14 },
      { x: 166, y: 65, width: 16, height: 15 }
    ],
    passives: [
      { x: 221, y: 27, width: 16, height: 18 },
      { x: 238, y: 12, width: 17, height: 18 },
      { x: 262, y: 6, width: 16, height: 16 }
    ]
  }
};

/*
  Bottom to top. The things in the holes sit under the overlay (its glass and rims over them); the key numbers, the
  passives' smoke, the reward glow and the death words sit over it.
*/
const LAYER_ORDER = [
  "plateBack", // the plate behind
  "portraitBack", // the portrait's circuit disc, in the avatar's color
  "portrait",
  "health",
  "actives",
  "keys",
  "passives",
  "plateFront", // the overlay: the metal, its holes and glass
  "passiveSmoke",
  "rewardGlow",
  "deathWords"
];
export const HUD_LAYERS = Object.fromEntries(LAYER_ORDER.map((name, k) => [name, k + 1]));

// a HUD's size on screen (in the HUD column's design pixels: the column scales with the game)
export const HUD_VARIANTS = {
  player: { plate: "player", scale: 381 / 483 }, // (as it was: 381 wide)
  teammate: { plate: "teammate", scale: 284 / 355 }, // (as it was: 284 wide)
  compact: { plate: "teammate", scale: 210 / 355 } // for a crowd (more than three HUDs): not the player's
};

export const HUD_LOOK = {
  gap: 12, // between HUDs in the column
  plateBackFilter: "brightness(0.5) drop-shadow(-2px 2px 10px black) hue-rotate(275deg)",
  // the portrait's circuit disc, tinted the avatar's color (its radiation color: Jamie)
  disc: { src: "/spritesheet/horizontal_circuit_disc_sprite.png", frames: 9, frameWidth: 592, frameHeight: 359, seconds: 4, opacity: 0.75 },
  portraitGlow: 0.55, // the color's glow behind the figure
  // the portrait's picture, in its hole: as wide as this share of it, from the top
  portraitImageWidth: 0.97,
  // the powers: a ring of its color in the socket, the icon this share of the socket
  activeRing: 0.06,
  activeIcon: 0.5,
  keyText: "#152642",
  // the passives: dim until they've worked, then lit
  passiveIcon: 0.62,
  passiveDim: 0.2,
  // the passive's smoke when it first works: the sprite's shape, as many socket-widths wide
  smoke: { src: "spritesheet/passiveAbilityActivationSprite_TEST.png", frames: 11, frameWidth: 77.46, frameHeight: 214, widthInSockets: 3.2, ms: 750 },
  health: { equalFrom: 4, maxCapsules: 16, shareOfBar: 80, from: "#d22b2b", to: "#880808", bonus: ["#2bd24a", "#065d1c"], lost: ["#dfdfdf", "#c8c8c8"] },
  deathWords: { text: "Wasted!", color: "rgb(113, 255, 113)" },
  healthFlicker: { low: 0.6, high: 0.9, ms: 50 }, // the health's hologram flicker (brighter: it is under the glass now)
  reward: { color: "#ff2a3c", glow: "#ff0020" }
};
