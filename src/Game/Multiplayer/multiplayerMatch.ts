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
  in this order: up to 3 recruits (theirs), then an Agent (Jamie: 4 at most). Each player's team is their own (their teammate, the recruits
  they have), its powers settled in their browser and sent with the rest, so both build it alike.
*/
export type TeamMember = { avatar: string; powers: Array<string>; kind: 'teammate' | 'recruit' | 'agent' }; // (powers: elements)
export type MultiplayerSide = { avatar: string; powers: Array<string>; color?: string; team?: Array<TeamMember> }; // (powers: the picker's elements, uppercase; color: picked in the vat)
export type MultiplayerSetup = { mode: 'standing' | 'defense'; level: string; teamSize: number };
export type MultiplayerConfig = MultiplayerSetup & { host: MultiplayerSide; guest: MultiplayerSide };
export const GUEST_PIECE_INDEX = 1;
export const MAX_TEAM_SIZE = 4; // (up to 3 recruits and the Agent: no Guy or Girl teammate, the players are those: Jamie)
export const DEFAULT_SETUP: MultiplayerSetup = { mode: 'standing', level: 'peninsula', teamSize: 0 };

// the battlegrounds: each level as it is, less its boss, its hazards, its Kaiju ('thumbnail': its whole scene, small)
const NO_HAZARDS = { rival: undefined, ghostBoss: undefined, aquariumFlood: undefined, kaijuEntry: undefined, agentDrops: undefined, walkIn: undefined, isMultiplayer: true };
// (the boss fights' Kaiju parts, the eye, the head, the tongue, are the boss's: left out too)
const BOSS_PARTS = ['eye', 'head', 'tongue'];
const getCalmPhases = (level: any) => level.defaultPhases.filter((id: string) => !BOSS_PARTS.includes(id));
const getGlassPhases = (level: any) => level.phases.map(({ id }: any) => id).filter((id: string) => id.startsWith('glass'));
export const BATTLEGROUNDS = [
  { id: 'peninsula', name: 'Peninsula', thumbnail: ['/Map.gif'], thumbnailPosition: '50% 4%', thumbnailZoom: 1.5, getLevel: () => ({ ...LEVELS.peninsula, ...NO_HAZARDS }) },
  { id: 'rapidTransit', name: 'Rapid Transit', thumbnail: ['/levels/rapidTransit.png'], getLevel: () => ({ ...LEVELS.rapidTransit, ...NO_HAZARDS, defaultPhases: getCalmPhases(LEVELS.rapidTransit) }) }, // (its train kept: Jamie)
  { id: 'rooftop', name: 'Rooftop', thumbnail: ['/levels/rooftop.png'], getLevel: () => ({ ...LEVELS.rooftop, ...NO_HAZARDS, defaultPhases: getCalmPhases(LEVELS.rooftop) }) },
  { id: 'aquarium', name: 'Aquarium', thumbnail: ['/levels/aquarium.png'], getLevel: () => ({ ...LEVELS.aquarium, ...NO_HAZARDS, defaultPhases: getCalmPhases(LEVELS.aquarium) }) },
  // (flooded from the start: the glass broken and the hall under water, the wakes behind everyone in it: Jamie)
  { id: 'floodedAquarium', name: 'Flooded Aquarium', thumbnail: ['/levels/aquarium.png', '/levels/aquarium/shattered.png'], getLevel: () => ({ ...LEVELS.aquarium, ...NO_HAZARDS, defaultPhases: [...getCalmPhases(LEVELS.aquarium), 'shattered', ...getGlassPhases(LEVELS.aquarium)] }) }
];
export const getBattleground = (id: string) => BATTLEGROUNDS.find(ground => ground.id == id) || BATTLEGROUNDS[0];
// where each side starts: the Peninsula's top and bottom; elsewhere, the player's own start and the boss's
const getStartSpots = (id: string) => {
  if (id == 'peninsula') return { host: TOP_SPOTS[0], guest: BOTTOM_SPOTS[0] };
  const level: any = (LEVELS as any)[id == 'floodedAquarium' ? 'aquarium' : id];
  return { host: undefined, guest: level.rival.spot };
};
export const MULTIPLAYER_LEVEL = BATTLEGROUNDS[0].getLevel(); // (the default)
export const getMultiplayerKillsToWin = (config: MultiplayerConfig) => undefined; // (decided by the teams: setUpMultiplayerMatch)

// a player's team, in their browser, from what they have (Jamie): the teammate's powers random as ever (one to attack, one
// to defend...), the recruits' their own, the Agent's one of the Agents' kits
export const makeTeam = ({ size, recruits, settingsManager }: { size: number; teammate?: string; recruits: Array<string>; settingsManager: any }): Array<TeamMember> => {
  const members: Array<TeamMember> = [];
  // (the powers' data is only made as a match starts: before the first, it isn't there yet)
  if (!settingsManager.abilityAndTileStatusData || !Object.keys(settingsManager.abilityAndTileStatusData).length) settingsManager.initAbilityStatusData();
  const getRecruitPowers = (avatar: string) => avatar == 'hazmat' ? HAZMAT_RECRUIT.abilities : ((Object.values(LEVELS) as any).find(({ rival }: any) => rival && rival.avatar == avatar) || { rival: { abilities: [] } }).rival.abilities;
  recruits.slice(0, 3).forEach(avatar => { if (members.length < size) members.push({ avatar, kind: 'recruit', powers: getRecruitPowers(avatar) }); });
  if (members.length < size) {
    const kits = Object.values((LEVELS as any).lab.agentDrops.kits) as Array<Array<string>>;
    members.push({ avatar: 'agent', kind: 'agent', powers: kits[Math.floor(Math.random() * kits.length)] });
  }
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
export const updateGuestTakeOver = (gm: any): number | undefined => {
  const handler = gm.guestInputHandler;
  if (!handler || !handler.piece.getIsDead()) return undefined;
  if (gm.guestTakeOverAt === undefined) gm.guestTakeOverAt = Date.now() + TAKE_OVER_HOLD_MS;
  if (Date.now() < gm.guestTakeOverAt) return undefined;
  gm.guestTakeOverAt = undefined;
  const next = gm.getPieces().find((piece: any) => piece.teamIndex == 1 && !piece.getIsDead() && piece.isOnTiles);
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

// the two pieces in place, after the match's own initGame (the host's avatar and powers already its player)
export const setUpMultiplayerMatch = (gm: any, config: MultiplayerConfig, role: 'host' | 'guest') => {
  const piecesManager = gm.gameBoardPiecesManager;
  const [hostPiece] = gm.getPieces();
  const spots = getStartSpots(config.level);
  if (spots.host) hostPiece.initCharLocation(true, gm.gameBoardManager.getClosestWalkableTileToLocation(spots.host));
  const guestPiece = piecesManager.addPiece({
    pieceInfo: { ...(PIECES_INFO as any)[config.guest.avatar], abilities: gm.settingsManager.getAbilitiesFromElements(config.guest.powers.map(power => power[0].toLowerCase() + power.slice(1))), maxLives: hostPiece.maxLives, moveSpeed: hostPiece.moveSpeed },
    teamIndex: 1
  });
  guestPiece.initCharLocation(true, gm.gameBoardManager.getClosestWalkableTileToLocation(spots.guest));
  guestPiece.isNpc = false;
  // each player's color, from the vat (Jamie)
  if (config.host.color) hostPiece.setColor(config.host.color);
  if (config.guest.color) guestPiece.setColor(config.guest.color);
  // each side's team, the host's then the guest's (the same order in both browsers), beside their player
  [[config.host, hostPiece, 0], [config.guest, guestPiece, 1]].forEach(([side, leader, teamIndex]: any) => (side.team || []).forEach((member: TeamMember) => {
    const piece = piecesManager.addPiece({
      pieceInfo: { ...(PIECES_INFO as any)[member.avatar], abilities: gm.settingsManager.getAbilitiesFromElements(member.powers), maxLives: hostPiece.maxLives, moveSpeed: hostPiece.moveSpeed },
      teamIndex
    });
    if (member.kind == 'recruit') piece.isRecruit = true;
    piece.initCharLocation(true, gm.getFreeTileNear(leader.getTileIndex(), { except: piece }) || leader.getTileIndex());
  }));
  // each side in its player's color (Jamie): every one's glow and the tile under them, and their damaging powers' tiles
  const teamColors = [config.host.color || hostPiece.color, config.guest.color || guestPiece.color];
  piecesManager.pieces.forEach((piece: any) => { piece.color = teamColors[piece.teamIndex]; });
  const own = role == 'host' ? 0 : 1;
  gm.getStatusTeamColor = (casterIndex: number, teamIndex: number) => teamColors[teamIndex];
  gm.getEnemyLeaderColor = () => teamColors[1 - own];
  gm.getPlayerColor = () => teamColors[own];
  // the other side's health over their heads, on each screen (Jamie)
  piecesManager.pieces.forEach((piece: any) => { piece.isShowHealthBarOnComponent = piece.teamIndex != own; });
  // won or lost when a whole side is down (both browsers: the guest's from its own side)
  const getIsSideDown = (teamIndex: number) => piecesManager.pieces.filter((piece: any) => piece.teamIndex == teamIndex).every((piece: any) => piece.getIsDead());
  gm.getGameResult = () => (getIsSideDown(own) ? GameResult.PlayerLost : getIsSideDown(1 - own) ? GameResult.PlayerWon : null);
  if (role == 'host') {
    guestPiece.inputHandler = new RemoteInputHandler({ gameManagerProxy: gm.gameManagerProxy, piece: guestPiece });
    gm.guestInputHandler = guestPiece.inputHandler;
  } else {
    // the guest's view: its own piece is "the player" here (the camera, the HUD); this copy is never run, so it's only seen
    piecesManager.getPlayerPiece = () => piecesManager.pieces[GUEST_PIECE_INDEX];
    piecesManager.getPlayerTeamIndex = () => 1;
    gm.controlledPiece = guestPiece;
  }
  return guestPiece;
};
