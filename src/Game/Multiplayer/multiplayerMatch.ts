import { PlayerInputHandler } from '../DataClasses/PlayerInputHandler';
import { GameResult, HAZMAT_RECRUIT } from '../DataClasses/GameManager';
import { LEVELS } from '../DataClasses/Levels/levels';
import { BOTTOM_SPOTS, TOP_SPOTS } from '../DataClasses/balance/simulate';
import { PIECES_INFO } from 'Utils/gameState';

/*
  A multiplayer match (Jamie, 2026-11-19). Both browsers build it the same way, so their pieces line up index for index:
  piece 0 the host's avatar (team 0, along the top), piece 1 the guest's (team 1, along the bottom).
  - on the host, the guest's piece is driven by the guest's keys, sent over (RemoteInputHandler), the match run as any;
  - on the guest, the match isn't run (mirror.ts sets the host's changes on it), and its view is the guest's: its
    "player" is piece 1, so the camera and the HUD follow the guest.
  Mode 1, last one standing: won when the other side's whole team is down.
  The match setup (Jamie, 2026-11-19): the host picks the battleground (BATTLEGROUNDS: their bosses and hazards left
  out, the subway's train kept, the flooded Aquarium flooded) and whether there are teams: up to 5 more on each side,
  in this order: an Agent, then their recruits (Jamie: 5 at most, the Hazmat Worker if the host has them). Each player's team is their own (their teammate, the recruits
  they have), its powers settled in their browser and sent with the rest, so both build it alike.
*/
export type TeamMember = { avatar: string; powers: Array<string>; kind: 'teammate' | 'recruit' | 'agent' }; // (powers: elements)
export type MultiplayerSide = { avatar: string; powers: Array<string>; color?: string; team?: Array<TeamMember> }; // (powers: the picker's elements, uppercase; color: picked in the vat)
export type MultiplayerSetup = { mode: 'standing' | 'defense' | 'coop'; level: string; teamSize: number; isHazmat?: boolean; kaijuToWin?: number }; // ('isHazmat': the host has the Hazmat Worker, so both sides may; 'kaijuToWin': defense's count)
export type MultiplayerConfig = MultiplayerSetup & { host: MultiplayerSide; guest: MultiplayerSide };
export const GUEST_PIECE_INDEX = 1;
export const MAX_TEAM_SIZE = 5; // (the Agent and up to 4 recruits, the Hazmat Worker among them once the host has them: no Guy or Girl teammate, the players are those. 6 HUDs with the player's: Jamie)
const TEAM_ORDER = ['mermaid', 'punk', 'black_female', 'hazmat'];
export const DEFAULT_SETUP: MultiplayerSetup = { mode: 'standing', level: 'peninsula', teamSize: 0, kaijuToWin: 20 };
export const MAX_KAIJU_TO_WIN = 100;

/*
  Peninsula defense (Jamie, 2026-11-19): both sides on the Peninsula against its Kaiju, allies (no hurting each other),
  each Kaiju's kill to the side that hit it last; once the count's reached, the side with the most wins.
  Both sides are one team to the game (team 0: the Kaiju's foes, never each other's); each piece's 'side' (0 the host's,
  1 the guest's) is whose it is: their HUDs, color, take-over and kills.
*/
export const DEFENSE_LEVEL = () => ({ ...LEVELS.peninsula, isMultiplayer: true, isDefense: true, rival: undefined });
export const getSideKills = (gm: any) => {
  const kills = [0, 0];
  gm.getPieces().forEach((piece: any) => {
    if (piece.side !== undefined || !piece.getIsDead() || piece.lastHitBy === undefined || piece.lastHitBy < 0) return;
    const hitter = gm.getPieces()[piece.lastHitBy];
    if (hitter && hitter.side !== undefined) kills[hitter.side] += 1;
  });
  return kills;
};

// the battlegrounds: each level as it is, less its boss, its hazards, its Kaiju ('thumbnail': its whole scene, small)
const NO_HAZARDS = { rival: undefined, ghostBoss: undefined, aquariumFlood: undefined, kaijuEntry: undefined, agentDrops: undefined, walkIn: undefined, isMultiplayer: true };
// (the boss fights' Kaiju parts, the eye, the head, the tongue, are the boss's: left out too)
const BOSS_PARTS = ['eye', 'head', 'tongue'];
const getCalmPhases = (level: any) => level.defaultPhases.filter((id: string) => !BOSS_PARTS.includes(id));
export const BATTLEGROUNDS = [
  { id: 'peninsula', name: 'Peninsula', thumbnail: ['/Map.gif'], thumbnailPosition: '50% 4%', thumbnailZoom: 1.5, getLevel: () => ({ ...LEVELS.peninsula, ...NO_HAZARDS }) },
  { id: 'rapidTransit', name: 'Rapid Transit', thumbnail: ['/levels/rapidTransit.png'], getLevel: () => ({ ...LEVELS.rapidTransit, ...NO_HAZARDS, defaultPhases: getCalmPhases(LEVELS.rapidTransit) }) }, // (its train kept: Jamie)
  { id: 'rooftop', name: 'Rooftop', thumbnail: ['/levels/rooftop.png'], getLevel: () => ({ ...LEVELS.rooftop, ...NO_HAZARDS, defaultPhases: getCalmPhases(LEVELS.rooftop) }) },
  // (no skylight shards on its floor: they're the scream's, Jamie)
  { id: 'aquarium', name: 'Aquarium', thumbnail: ['/levels/aquarium.png'], getLevel: () => ({ ...LEVELS.aquarium, ...NO_HAZARDS, defaultPhases: getCalmPhases(LEVELS.aquarium).filter((id: string) => id != 'shards') }) },
  // (flooded from the start: the hall broken, dim and under water, the wakes behind everyone in it; already so as it
  // opens, not breaking: the glass panels' breaking (the fish falling) never runs, and the shattered hall's there at once:
  // Jamie)
  { id: 'floodedAquarium', name: 'Flooded Aquarium', thumbnail: ['/levels/aquarium.png', '/levels/aquarium/shattered.png'], getLevel: () => ({ ...LEVELS.aquarium, ...NO_HAZARDS, defaultPhases: [...getCalmPhases(LEVELS.aquarium), 'shattered'], sceneElements: LEVELS.aquarium.sceneElements.map((element: any) => element.phase == 'shattered' && element.type == 'image' ? { ...element, fadeSeconds: 0, delaySeconds: 0 } : element) }) },
  // the Lab (Jamie): its fight's portal up to the catwalk open the whole match (setUpMultiplayerMatch), no Agents or talk
  { id: 'lab', name: 'Lab', thumbnail: ['/levels/lab-window.png', '/levels/lab.png'], getLevel: () => ({ ...LEVELS.lab, ...NO_HAZARDS, showdown: undefined, extras: [], transformScene: undefined }) }
];
export const getBattleground = (id: string) => BATTLEGROUNDS.find(ground => ground.id == id) || BATTLEGROUNDS[0];
// where each side starts: the Peninsula's top and bottom; elsewhere, the player's own start and the boss's
const getStartSpots = (id: string, mode = 'standing') => {
  if (mode == 'defense') return { host: TOP_SPOTS[0], guest: { x: TOP_SPOTS[0].x + 70, y: TOP_SPOTS[0].y + 20 } }; // (side by side)
  if (id == 'peninsula') return { host: TOP_SPOTS[0], guest: BOTTOM_SPOTS[0] };
  if (id == 'lab') return { host: undefined, guest: LAB_GUEST_SPOT };
  const level: any = (LEVELS as any)[id == 'floodedAquarium' ? 'aquarium' : id];
  return { host: undefined, guest: level.rival.spot };
};
export const MULTIPLAYER_LEVEL = BATTLEGROUNDS[0].getLevel(); // (the default)
const LAB_GUEST_SPOT = { x: 1150, y: 640 }; // (the Lab's floor, across from the player's start)
const LAB_PORTAL_FROM = { x: 700, y: 480 }; // (where its fight's Agent stands, and leaves his portal: levels.ts LAB_SCENE's extras)

// the Lab's portal, as its fight leaves it (GameManager.startShowdownFight), open for good
const openLabPortal = (gm: any) => {
  const { catwalkY, catwalkLastRow, portalWallRows, portalColumns } = (LEVELS as any).lab.agentDrops;
  const board = gm.gameBoardManager;
  const standTile = board.getClosestWalkableTileToLocation(LAB_PORTAL_FROM);
  const floorRows = board.walkableTiles.filter(({ i, j }: any) => i == standTile.i && j > catwalkLastRow).map(({ j }: any) => j);
  const below = floorRows.length ? { i: standTile.i, j: Math.min(...floorRows) + portalWallRows } : standTile;
  const floorTile = board.getIsInBounds(below) ? below : standTile;
  const portalTop = board.getClosestWalkableTileToLocation({ x: LAB_PORTAL_FROM.x + portalColumns * gm.level.grid.colStep * gm.level.grid.scale, y: catwalkY });
  board.addWormhole(floorTile, portalTop, gm.getAccTime(), Infinity);
};
export const getMultiplayerKillsToWin = (config: MultiplayerConfig) => (config.mode == 'defense' ? config.kaijuToWin || DEFAULT_SETUP.kaijuToWin : undefined); // (last team standing: decided by the teams, setUpMultiplayerMatch)

// a player's team, in their browser, from what they have (Jamie): the teammate's powers random as ever (one to attack, one
// to defend...), the recruits' their own, the Agent's one of the Agents' kits
export const makeTeam = ({ size, recruits, settingsManager }: { size: number; teammate?: string; recruits: Array<string>; settingsManager: any }): Array<TeamMember> => {
  const members: Array<TeamMember> = [];
  // (the powers' data is only made as a match starts: before the first, it isn't there yet)
  if (!settingsManager.abilityAndTileStatusData || !Object.keys(settingsManager.abilityAndTileStatusData).length) settingsManager.initAbilityStatusData();
  const getRecruitPowers = (avatar: string) => avatar == 'hazmat' ? HAZMAT_RECRUIT.abilities : ((Object.values(LEVELS) as any).find(({ rival }: any) => rival && rival.avatar == avatar) || { rival: { abilities: [] } }).rival.abilities;
  // (Jamie's order: the Agent, then the Aquarium Worker, Punk Guy, Ghost Girl, the Hazmat Worker, as they're had)
  if (size > 0) {
    const kits = Object.values((LEVELS as any).lab.agentDrops.kits) as Array<Array<string>>;
    members.push({ avatar: 'agent', kind: 'agent', powers: kits[Math.floor(Math.random() * kits.length)] });
  }
  TEAM_ORDER.filter(avatar => recruits.includes(avatar)).forEach(avatar => { if (members.length < size) members.push({ avatar, kind: 'recruit', powers: getRecruitPowers(avatar) }); });
  return members.slice(0, size);
};

// the guest's keys, on the host: as the player's own, but for the guest's piece
export class RemoteInputHandler extends PlayerInputHandler {
  piece: any;

  constructor({ gameManagerProxy, piece }: { gameManagerProxy: any; piece: any }) {
    super({ gameManagerProxy });
    this.piece = piece;
  }

  // (no hovered tile to clear: that's the host's mouse)
  addKey(code: string) {
    this.pressedKeys = !this.pressedKeys.includes(code) ? [...this.pressedKeys, code] : this.pressedKeys;
  }

  getPressedDir() {
    const piece = this.piece;
    if (piece.isHeld || piece.getIsRewardPulse()) return 'idle';
    if (this.gameManagerProxy.getIsFightOver()) return 'idle';
    const pressedDir = this.getHeldDir();
    const reversed: any = { up: 'down', down: 'up', left: 'right', right: 'left', 'up left': 'down right', 'up right': 'down left', 'down left': 'up right', 'down right': 'up left', idle: 'idle' };
    return piece.isCharmed ? reversed[pressedDir] : pressedDir;
  }

  usePlayerAbilityFromIndex(i: number, accTime: number) {
    if (i < 0 || i >= 3) return;
    this.useControlledAbility(this.piece, i, accTime);
  }
}

/*
  The guest's take-over (Jamie), on the host: their piece down and someone of their side still fighting, once the camera's
  held on the death (as the player's own: GameManager.updateTakeOver), their keys move on to the next of their side, in
  the HUDs' order. Returns that one's index when it changes (the guest's camera and HUD follow: Game's 'control').
*/
const TAKE_OVER_HOLD_MS = 1800;
// (the guest's own shots: as the host's train close-up (CUTSCENE's outcome zoom) and portal walk, roughly)
const GUEST_SHOT = { knockZoom: 2.6, knockPanMs: 450, jumpPx: 120, portalPanMs: 500, portalMs: 1100 };
export const updateGuestTakeOver = (gm: any): number | undefined => {
  const handler = gm.guestInputHandler;
  if (!handler || !handler.piece.getIsDead()) return undefined;
  if (gm.guestTakeOverAt === undefined) gm.guestTakeOverAt = Date.now() + TAKE_OVER_HOLD_MS;
  if (Date.now() < gm.guestTakeOverAt) return undefined;
  gm.guestTakeOverAt = undefined;
  const isFree = (piece: any) => !piece.getIsDead() && piece.isOnTiles && !piece.inputHandler;
  const next = gm.getPieces().find((piece: any) => isFree(piece) && (gm.isCoop ? piece.teamIndex == 0 && piece.isRecruit && piece != gm.getControlledPiece() : piece.side == 1));
  if (!next) return undefined;
  handler.piece.inputHandler = undefined;
  next.isNpc = false;
  next.moveToTiles = [];
  next.walkToTile = undefined;
  next.brainAction = undefined;
  next.inputHandler = handler;
  handler.piece = next;
  handler.pressedKeys = [];
  return next.pieceIndex;
};

/*
  Co-op Campaign (Jamie, 2026-11-20): the campaign as ever on the host, the teammate played by the guest. Both browsers
  build each fight alike ('coopMatch': the host's own GameManager's arguments), and here the teammate takes the guest's
  powers and color; on the host it's driven by the guest's keys, on the guest it's who they play (camera, HUD). A fight
  with no teammate (a solo one): the guest watches. In a cutscene the guest's camera is the host's ('coopHostShot').
*/
export const setUpCoop = (gm: any, config: MultiplayerConfig, role: 'host' | 'guest') => {
  const piecesManager = gm.gameBoardPiecesManager;
  const pieces = gm.getPieces();
  gm.isCoop = true;
  if (role == 'host') wrapCoopDialogue(gm);
  const host = pieces[0];
  host.side = 0;
  if (config.host.color) host.color = config.host.color;
  const teammate = pieces.find((piece: any) => piece.pieceIndex != 0 && piece.teamIndex == host.teamIndex && !piece.isRecruit && piece.avatar == config.guest.avatar);
  if (role == 'guest') gm.getCameraShot = () => gm.coopHostShot;
  if (!teammate) return undefined;
  teammate.side = 1;
  teammate.abilities = gm.settingsManager.getAbilitiesFromElements(config.guest.powers.map(power => power[0].toLowerCase() + power.slice(1)));
  if (config.guest.color) teammate.color = config.guest.color;
  teammate.isNpc = false;
  if (role == 'host') {
    teammate.inputHandler = new RemoteInputHandler({ gameManagerProxy: gm.gameManagerProxy, piece: teammate });
    gm.guestInputHandler = teammate.inputHandler;
  } else {
    piecesManager.getPlayerPiece = () => teammate;
    gm.controlledPiece = teammate;
    // (their own HUD first, the player's place; the host's after it)
    const ownFirst = piecesManager.getPlayerTeamUiState;
    piecesManager.getPlayerTeamUiState = () => {
      const states = ownFirst.call(piecesManager);
      const index = piecesManager.getTeamPieces(host.teamIndex).filter((piece: any) => !piece.isRecruit).indexOf(teammate);
      return index > 0 ? [states[index], ...states.filter((_: any, k: number) => k != index)] : states;
    };
  }
  return teammate;
};

/*
  Co-op's lines (Jamie): a line waiting for Enter needs both players' Enter. Each has COOP_LINE.autoMs from the line being
  up (typed out) before it's pressed for them; with both, it holds COOP_LINE.holdMs (the two checks seen) and goes on.
  On the host: its own Enter is its check (advanceDialogue, wrapped); the guest's comes over ('enter': coopVote). Lines
  that move on by themselves are left alone. Returns the checks, for both screens.
*/
export const COOP_LINE = { autoMs: 3000, holdMs: 700 };

/*
  Co-op's Recruit or Terminate (Jamie): each player votes within COOP_VOTE.ms. One vote: it stands; the same: it stands;
  split, or none: a coin flip. 'flip' (0..1) is the coin.
*/
export const COOP_VOTE = { ms: 7000, revealMs: 1600 };
export const resolveCoopVote = (host: string | undefined, guest: string | undefined, flip: number) => {
  const votes = [host, guest].filter(Boolean) as Array<string>;
  if (votes.length == 1 || (votes.length == 2 && votes[0] == votes[1])) return { choice: votes[0], isFlip: false };
  return { choice: flip < 0.5 ? 'recruit' : 'terminate', isFlip: true };
};
export type CoopChecks = { isWaiting: boolean; host: boolean; guest: boolean };
const getLineKey = (gm: any) => (gm.cutscene ? `c${gm.cutscene.index}` : `t${gm.talks.map((talk: any) => `${talk.index}${talk.isWaiting ? 'w' : ''}`).join()}`);
export const wrapCoopDialogue = (gm: any) => {
  const advance = gm.advanceDialogue.bind(gm);
  gm.coopVotes = undefined;
  gm.coopVote = (who: 'host' | 'guest') => { if (gm.coopVotes) gm.coopVotes[who] = true; };
  gm.advanceDialogue = () => {
    if (!gm.getIsDialogueWaiting()) return advance();
    gm.coopVote('host');
    return true;
  };
  gm.updateCoopDialogue = (now: number): CoopChecks => {
    if (!gm.getIsDialogueWaiting()) {
      gm.coopVotes = undefined;
      return { isWaiting: false, host: false, guest: false };
    }
    const key = getLineKey(gm);
    if (!gm.coopVotes || gm.coopVotes.key != key) gm.coopVotes = { key, host: false, guest: false, since: now, bothAt: undefined };
    const votes = gm.coopVotes;
    if (now - votes.since >= COOP_LINE.autoMs) { votes.host = true; votes.guest = true; }
    if (votes.host && votes.guest) {
      if (votes.bothAt === undefined) votes.bothAt = now;
      if (now - votes.bothAt >= COOP_LINE.holdMs) {
        gm.coopVotes = undefined;
        advance();
        return { isWaiting: false, host: false, guest: false };
      }
    }
    return { isWaiting: true, host: votes.host, guest: votes.guest };
  };
};

/*
  Co-op's last fight (Jamie): the teammate turns into a Kaiju, every power and much health: the guest goes on as it,
  against the host (as in sparring). On the host each frame: once it's there, the guest's keys move to it. Returns its
  index when they do (the guest's camera and HUD follow: Game's 'control').
*/
// (and sparring's rival, once it's there: the teammate the player spars, the guest against the host. Jamie)
export const updateCoopTurnedKaiju = (gm: any): number | undefined => {
  if (!gm.isCoop) return undefined;
  const rival = gm.level.rival && gm.level.rival.isSparring ? gm.rivalPiece : undefined;
  const target = [gm.teammateKaiju, rival].find((piece: any) => piece && !piece.getIsDead());
  let handler = gm.guestInputHandler;
  if (!target || (handler && handler.piece == target)) return undefined;
  if (!handler) {
    handler = new RemoteInputHandler({ gameManagerProxy: gm.gameManagerProxy, piece: target });
    gm.guestInputHandler = handler;
  }
  if (handler.piece) handler.piece.inputHandler = undefined;
  target.isNpc = false;
  target.moveToTiles = [];
  target.brainAction = undefined;
  target.inputHandler = handler;
  handler.piece = target;
  handler.pressedKeys = [];
  return target.pieceIndex;
};

// the two pieces in place, after the match's own initGame (the host's avatar and powers already its player)
export const setUpMultiplayerMatch = (gm: any, config: MultiplayerConfig, role: 'host' | 'guest') => {
  const piecesManager = gm.gameBoardPiecesManager;
  const [hostPiece] = gm.getPieces();
  const isDefense = config.mode == 'defense';
  const spots = getStartSpots(config.level, config.mode);
  hostPiece.side = 0;
  if (spots.host) hostPiece.initCharLocation(true, gm.gameBoardManager.getClosestWalkableTileToLocation(spots.host));
  const guestPiece = piecesManager.addPiece({
    pieceInfo: { ...(PIECES_INFO as any)[config.guest.avatar], abilities: gm.settingsManager.getAbilitiesFromElements(config.guest.powers.map(power => power[0].toLowerCase() + power.slice(1))), maxLives: hostPiece.maxLives, moveSpeed: hostPiece.moveSpeed },
    teamIndex: isDefense ? 0 : 1 // (defense: one team with the host's against the Kaiju)
  });
  guestPiece.side = 1;
  guestPiece.initCharLocation(true, gm.gameBoardManager.getClosestWalkableTileToLocation(spots.guest));
  guestPiece.isNpc = false;
  // each player's color, from the vat (Jamie)
  if (config.host.color) hostPiece.setColor(config.host.color);
  if (config.guest.color) guestPiece.setColor(config.guest.color);
  // each side's team, the host's then the guest's (the same order in both browsers), beside their player
  [[config.host, hostPiece, 0], [config.guest, guestPiece, 1]].forEach(([side, leader, sideIndex]: any) => (side.team || []).forEach((member: TeamMember) => {
    const piece = piecesManager.addPiece({
      pieceInfo: { ...(PIECES_INFO as any)[member.avatar], abilities: gm.settingsManager.getAbilitiesFromElements(member.powers), maxLives: hostPiece.maxLives, moveSpeed: hostPiece.moveSpeed },
      teamIndex: isDefense ? 0 : sideIndex
    });
    piece.side = sideIndex;
    if (member.kind == 'recruit') piece.isRecruit = true;
    piece.initCharLocation(true, gm.getFreeTileNear(leader.getTileIndex(), { except: piece }) || leader.getTileIndex());
  }));
  // each side in its player's color (Jamie): every one's glow and the tile under them, and their damaging powers' tiles
  const teamColors = [config.host.color || hostPiece.color, config.guest.color || guestPiece.color];
  piecesManager.pieces.forEach((piece: any) => { piece.color = teamColors[piece.side]; });
  const own = role == 'host' ? 0 : 1;
  const enemyColor = gm.getEnemyLeaderColor(); // (the Kaiju's, in defense)
  gm.getStatusTeamColor = (casterIndex: number, teamIndex: number) => {
    const caster = gm.getPieces()[casterIndex];
    return caster && caster.side !== undefined ? teamColors[caster.side] : enemyColor;
  };
  gm.getEnemyLeaderColor = () => (isDefense ? enemyColor : teamColors[1 - own]);
  gm.getPlayerColor = () => teamColors[own];
  // the other side's health over their heads, on each screen (Jamie); in defense, the other side's no foe
  piecesManager.pieces.forEach((piece: any) => { piece.isShowHealthBarOnComponent = !isDefense && piece.side != own; });
  // each screen's HUDs: its own side's (the recruits' list was everyone's)
  piecesManager.getPlayerTeamUiState = () => piecesManager.pieces.filter((piece: any) => piece.side == own && !piece.isRecruit).map((piece: any) => piece.getUiState());
  piecesManager.getRecruitsUiState = () => piecesManager.pieces.filter((piece: any) => piece.side == own && piece.isRecruit).map((piece: any) => piece.getUiState());
  if (config.level == 'lab') openLabPortal(gm);
  // won or lost when a whole side is down (both browsers: the guest's from its own side)
  const getIsSideDown = (side: number) => piecesManager.pieces.filter((piece: any) => piece.side == side).every((piece: any) => piece.getIsDead());
  if (isDefense) {
    // the Kaiju beaten: the side with the most of them; both sides down: lost to the Kaiju
    const toWin = config.kaijuToWin || DEFAULT_SETUP.kaijuToWin || 20;
    gm.getGameResult = () => {
      if (getIsSideDown(0) && getIsSideDown(1)) return GameResult.PlayerLost;
      const kills = getSideKills(gm);
      if (kills[0] + kills[1] < toWin) return null;
      return kills[own] >= kills[1 - own] ? GameResult.PlayerWon : GameResult.PlayerLost;
    };
    gm.getMultiplayerScore = () => { const kills = getSideKills(gm); return { mine: kills[own], theirs: kills[1 - own], toWin }; };
    // (both sides down: the Kaiju's win, not either player's)
    gm.getMultiplayerTitle = (isWon: boolean) => (getIsSideDown(0) && getIsSideDown(1) ? "The Kaiju won!" : isWon ? "You Won!" : "You Lost");
  } else {
    gm.getGameResult = () => (getIsSideDown(own) ? GameResult.PlayerLost : getIsSideDown(1 - own) ? GameResult.PlayerWon : null);
  }
  if (role == 'host') {
    guestPiece.inputHandler = new RemoteInputHandler({ gameManagerProxy: gm.gameManagerProxy, piece: guestPiece });
    gm.guestInputHandler = guestPiece.inputHandler;
  } else {
    // the guest's view: its own piece is "the player" here (the camera, the HUD); this copy is never run, so it's only seen
    piecesManager.getPlayerPiece = () => piecesManager.pieces[GUEST_PIECE_INDEX];
    piecesManager.getPlayerTeamIndex = () => (isDefense ? 0 : 1); // (defense: both sides one team)
    gm.controlledPiece = guestPiece;
    // the guest's camera (Jamie: no train close-up, nor portal zoom for them): from what the host's changes show, as the
    // host's own shots are the host's player's. Knocked down: in close on their body; through a portal or the stairs (a
    // jump across the board): in close where they come out, a moment
    let last: any;
    let jumpShot: any;
    gm.getCameraShot = () => {
      const piece = gm.getControlledPiece();
      if (!piece) return undefined;
      const knock = (piece.knockedUntil || 0) > gm.getAccTime() && piecesManager.deathPieces.find((death: any) => death.isKnockdown && death.pieceIndex == piece.pieceIndex);
      if (knock) return { point: { ...knock.charLocation }, zoomScale: GUEST_SHOT.knockZoom, panMs: GUEST_SHOT.knockPanMs, isPeninsulaSized: true };
      const here = piece.charLocation;
      if (last && last.piece == piece && Math.hypot(here.x - last.at.x, here.y - last.at.y) > GUEST_SHOT.jumpPx) jumpShot = { shot: { point: { ...here }, isPlayZoom: true, panMs: GUEST_SHOT.portalPanMs }, until: Date.now() + GUEST_SHOT.portalMs };
      last = { piece, at: { ...here } };
      return jumpShot && Date.now() < jumpShot.until ? jumpShot.shot : undefined;
    };
  }
  return guestPiece;
};
