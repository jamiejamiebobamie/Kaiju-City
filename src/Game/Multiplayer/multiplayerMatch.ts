import { PlayerInputHandler } from '../DataClasses/PlayerInputHandler';
import { LEVELS } from '../DataClasses/Levels/levels';
import { BOTTOM_SPOTS, TOP_SPOTS } from '../DataClasses/balance/simulate';
import { PIECES_INFO } from 'Utils/gameState';

/*
  A multiplayer match (Jamie, 2026-11-19). Both browsers build it the same way, so their pieces line up index for index:
  piece 0 the host's avatar (team 0, along the top), piece 1 the guest's (team 1, along the bottom).
  - on the host, the guest's piece is driven by the guest's keys, sent over (RemoteInputHandler), the match run as any;
  - on the guest, the match isn't run (mirror.ts sets the host's changes on it), and its view is the guest's: its
    "player" is piece 1, so the camera and the HUD follow the guest.
  Mode 1, last one standing: the Peninsula without its Kaiju, won when the other's piece falls.
*/
export type MultiplayerSide = { avatar: string; powers: Array<string> }; // (powers: the picker's elements, uppercase)
export type MultiplayerConfig = { mode: 'standing'; host: MultiplayerSide; guest: MultiplayerSide };
export const GUEST_PIECE_INDEX = 1;

export const MULTIPLAYER_LEVEL = { ...LEVELS.peninsula, kaijuEntry: undefined, isMultiplayer: true };
export const getMultiplayerKillsToWin = (config: MultiplayerConfig) => (config.mode == 'standing' ? 1 : undefined);

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

// the two pieces in place, after the match's own initGame (the host's avatar and powers already its player)
export const setUpMultiplayerMatch = (gm: any, config: MultiplayerConfig, role: 'host' | 'guest') => {
  const piecesManager = gm.gameBoardPiecesManager;
  const [hostPiece] = gm.getPieces();
  hostPiece.initCharLocation(true, gm.gameBoardManager.getClosestWalkableTileToLocation(TOP_SPOTS[0]));
  const guestPiece = piecesManager.addPiece({
    pieceInfo: { ...(PIECES_INFO as any)[config.guest.avatar], abilities: gm.settingsManager.getAbilitiesFromElements(config.guest.powers.map(power => power[0].toLowerCase() + power.slice(1))), maxLives: hostPiece.maxLives, moveSpeed: hostPiece.moveSpeed },
    teamIndex: 1
  });
  guestPiece.initCharLocation(true, gm.gameBoardManager.getClosestWalkableTileToLocation(BOTTOM_SPOTS[0]));
  guestPiece.isNpc = false;
  if (role == 'host') {
    guestPiece.inputHandler = new RemoteInputHandler({ gameManagerProxy: gm.gameManagerProxy, piece: guestPiece });
  } else {
    // the guest's view: its own piece is "the player" here (the camera, the HUD); this copy is never run, so it's only seen
    piecesManager.getPlayerPiece = () => piecesManager.pieces[GUEST_PIECE_INDEX];
    piecesManager.getPlayerTeamIndex = () => 1;
    gm.controlledPiece = guestPiece;
  }
  return guestPiece;
};
