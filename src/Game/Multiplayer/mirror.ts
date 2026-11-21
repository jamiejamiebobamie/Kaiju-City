import { GameBoardTileStatusAndAbilityData } from '../DataClasses/GameBoard/Tile/GameBoardTileStatusAndAbilityData';
import { GameBoardPieceAgent } from '../DataClasses/GameBoard/Pieces/GameBoardPieceAgent';
import { GameBoardPieceBase } from '../DataClasses/GameBoard/Pieces/GameBoardPieceBase';
import { GameBoardPieceExtra } from '../DataClasses/GameBoard/Pieces/GameBoardPieceExtra';
import { GameBoardPieceGiant } from '../DataClasses/GameBoard/Pieces/GameBoardPieceGiant';
import { GameBoardPieceKaiju } from '../DataClasses/GameBoard/Pieces/GameBoardPieceKaiju';
import { PIECES_INFO } from 'Utils/gameState';

// a piece added mid-match (a Kaiju walking in, a recruit called): its kind, so the guest makes one of its own
const PIECE_KINDS: Array<[string, any]> = [['kaiju', GameBoardPieceKaiju], ['agent', GameBoardPieceAgent], ['giant', GameBoardPieceGiant], ['extra', GameBoardPieceExtra], ['base', GameBoardPieceBase]];
const getPieceKind = (piece: any) => (PIECE_KINDS.find(([, kind]) => piece instanceof kind) || PIECE_KINDS[PIECE_KINDS.length - 1])[0];
const getNewPieceInfo = (piece: any) => ({ kind: getPieceKind(piece), avatar: piece.avatar, teamIndex: piece.teamIndex, elements: (piece.abilities || []).map((ability: any) => ability.gameBoardPieceAbilityData && ability.gameBoardPieceAbilityData.element) });

/*
  Multiplayer's mirroring (Jamie, 2026-11-19): the host's browser runs the match; the guest's builds the same match but
  doesn't run it: each tick the host sends what changed on its pieces, its tiles and the match's clock, and the guest
  sets those on its own copies, so its board draws just as the host's does.
  - a field is sent only when it changed since it was last sent (its JSON compared);
  - the powers' shared data (GameBoardTileStatusAndAbilityData) goes by its status name, and a piece by its index, so
    the guest uses its own;
  - a piece's powers (class instances) have their plain fields sent, set on the guest's own powers in place;
  - references back into the engine (gameManagerProxy and the like) and functions never go.
*/
// (and each browser's own view of them: whose health bars show over their heads)
const PIECE_SKIP = new Set(['gameManagerProxy', 'pieces', 'teams', 'onBeforeDeath', 'pieceClass', 'deathPieces', 'inputHandler', 'isShowHealthBarOnComponent']);
const TILE_FIELDS = ['tileStatus', 'teleportTileStatus', 'currCount', 'teamIndex', 'targetIndex', 'dirs', 'wall', 'trailAge', 'cast', 'updateKey', 'dmgMultiplier'];
const GAME_FIELDS = ['accTime', 'activePhases', 'score']; // ('score': every Kaiju down, for defense's end on the guest too) // (the phases: the subway's train coming and going, among them)
const MAX_DEPTH = 3;

const isPlain = (value: any) => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};
const isPiece = (value: any) => !!value && typeof value == 'object' && typeof value.pieceIndex == 'number' && 'charLocation' in value;

// to plain JSON, with markers for what the guest finds its own copies of
const encode = (value: any, depth = 0): any => {
  if (value === undefined) return { $u: 1 };
  if (typeof value == 'number' && !Number.isFinite(value)) return { $n: String(value) }; // (JSON can't: the Lab's portal never closes)
  if (value === null || typeof value != 'object') return typeof value == 'function' ? undefined : value;
  if (value instanceof GameBoardTileStatusAndAbilityData) return { $s: (value as any).appliedStatus };
  if (depth > 0 && isPiece(value)) return { $p: value.pieceIndex };
  if (depth >= MAX_DEPTH) return undefined;
  if (Array.isArray(value)) return value.map(item => encode(item, depth + 1));
  if (value instanceof Set) return { $set: [...value].map(item => encode(item, depth + 1)) };
  if (value instanceof Map) return undefined;
  if (isPlain(value)) {
    const out: any = {};
    Object.entries(value).forEach(([key, item]) => {
      const encoded = encode(item, depth + 1);
      if (encoded !== undefined) out[key] = encoded;
    });
    return out;
  }
  // another class's instance (a piece's power): its plain fields, set on the guest's own in place
  const fields: any = {};
  Object.entries(value).forEach(([key, item]) => {
    if (typeof item == 'function' || key == 'gameManagerProxy') return;
    const encoded = encode(item, depth + 1);
    if (encoded !== undefined) fields[key] = encoded;
  });
  return { $o: fields };
};

const decode = (value: any, gm: any, current: any = undefined): any => {
  if (value === null || typeof value != 'object') return value;
  if (Array.isArray(value)) {
    // (an instance the guest hasn't one of to set on is left out, not left a hole: the HUD reads every power)
    return value.map((item, k) => decode(item, gm, Array.isArray(current) ? current[k] : undefined)).filter((item, k) => item !== undefined || !(value[k] && value[k].$o));
  }
  if (value.$u) return undefined;
  if (value.$n !== undefined) return Number(value.$n);
  if (value.$s !== undefined) return gm.settingsManager.abilityAndTileStatusData[value.$s] || current; // (unknown here: its own kept)
  if (value.$p !== undefined) return gm.getPieces()[value.$p];
  if (value.$set) return new Set(value.$set.map((item: any) => decode(item, gm)));
  if (value.$o) {
    if (!current || typeof current != 'object') return current; // (no instance of its own to set them on: left)
    Object.entries(value.$o).forEach(([key, item]) => { current[key] = decode(item, gm, current[key]); });
    return current;
  }
  const out: any = {};
  Object.entries(value).forEach(([key, item]) => { out[key] = decode(item, gm, current && current[key]); });
  return out;
};

type NewPiece = { kind: string; avatar: string; teamIndex: number; elements: Array<string> };
type Changes = { wormholes?: any; deaths?: { keys: Array<string>; added: Array<any> }; game?: any; pieces?: Array<[number, any]>; tiles?: Array<[number, any]>; added?: Array<[number, NewPiece]> };

// the host's side: what changed since the last call
export class MirrorSender {
  private sent = new Map<string, string>();
  private pieceCount = 0;
  private deathKeysSent = new Set<string>();

  private changed(key: string, value: any) {
    const json = JSON.stringify(value);
    if (this.sent.get(key) === json) return false;
    this.sent.set(key, json);
    return true;
  }

  // (everything again: a guest joining late, or after a gap)
  reset() {
    this.sent.clear();
    this.pieceCount = 0;
    this.deathKeysSent = new Set();
  }

  collect(gm: any): Changes | undefined {
    const changes: Changes = {};
    const game: any = {};
    GAME_FIELDS.forEach(field => {
      const encoded = encode(gm[field]);
      if (this.changed(`g.${field}`, encoded)) game[field] = encoded;
    });
    if (Object.keys(game).length) changes.game = game;
    const pieces = gm.getPieces();
    if (pieces.length > this.pieceCount) {
      changes.added = pieces.slice(this.pieceCount).map((piece: any, k: number) => [this.pieceCount + k, getNewPieceInfo(piece)]);
      this.pieceCount = pieces.length;
    }
    const pieceChanges: Array<[number, any]> = [];
    pieces.forEach((piece: any, index: number) => {
      const fields: any = {};
      Object.keys(piece).forEach(key => {
        if (PIECE_SKIP.has(key) || typeof piece[key] == 'function') return;
        const encoded = encode(piece[key], 1);
        if (encoded !== undefined && this.changed(`p${index}.${key}`, encoded)) fields[key] = encoded;
      });
      if (Object.keys(fields).length) pieceChanges.push([index, fields]);
    });
    if (pieceChanges.length) changes.pieces = pieceChanges;
    const tileChanges: Array<[number, any]> = [];
    gm.gameBoardManager.getTilesInFlatArray().forEach((tile: any, index: number) => {
      const fields: any = {};
      TILE_FIELDS.forEach(key => {
        const encoded = encode(tile[key], 1);
        if (encoded !== undefined && this.changed(`t${index}.${key}`, encoded)) fields[key] = encoded;
      });
      if (Object.keys(fields).length) tileChanges.push([index, fields]);
    });
    if (tileChanges.length) changes.tiles = tileChanges;
    // (the ragdolls (deaths, knockdowns): which there are, and the new ones in full, less the physics' body: the guest's own
    // falls as the host's did. Jamie: no ragdolls on the guest's screen)
    const deaths = gm.gameBoardPiecesManager.deathPieces || [];
    const keys = deaths.map((death: any) => death.key);
    if (this.changed('deathKeys', keys)) {
      const added = deaths.filter((death: any) => !this.deathKeysSent.has(death.key)).map(({ body, ...death }: any) => Object.fromEntries(Object.entries(death).map(([key, value]) => [key, encode(value, 2)]))); // (field by field: an entry has a pieceIndex and a charLocation, as a piece does)
      deaths.forEach((death: any) => this.deathKeysSent.add(death.key));
      changes.deaths = { keys, added };
    }
    // (the wormholes a Teleport leaves, and the Lab's portal: the board's own list)
    const wormholes = encode(gm.gameBoardManager.wormholes, 0); // (from the top: their ends' tiles were past the depth kept)
    if (this.changed('wormholes', wormholes)) changes.wormholes = wormholes;
    return changes.game || changes.pieces || changes.tiles || changes.added || changes.wormholes || changes.deaths ? changes : undefined;
  }
}

// the guest's side: the host's changes set on its own match
export const applyChanges = (gm: any, changes: Changes) => {
  if (changes.game) Object.entries(changes.game).forEach(([key, value]) => { gm[key] = decode(value, gm); });
  // (pieces the host added: made here too, in the same order, then given their fields below)
  (changes.added || []).forEach(([index, info]) => {
    if (gm.getPieces().length != index) return; // (already here: the guest's own match made it, or it's out of step)
    const pieceClass = (PIECE_KINDS.find(([kind]) => kind == info.kind) || PIECE_KINDS[PIECE_KINDS.length - 1])[1];
    const abilities = gm.settingsManager.getAbilitiesFromElements(info.elements.filter(Boolean));
    gm.gameBoardPiecesManager.addPiece({ pieceClass, pieceInfo: { ...(PIECES_INFO as any)[info.avatar], abilities }, teamIndex: info.teamIndex });
  });
  const pieces = gm.getPieces();
  (changes.pieces || []).forEach(([index, fields]) => {
    const piece = pieces[index];
    if (!piece) return; // (a piece the guest hasn't: added by the host mid-match. Not yet mirrored)
    Object.entries(fields).forEach(([key, value]) => { piece[key] = decode(value, gm, piece[key]); });
  });
  if (changes.wormholes) gm.gameBoardManager.wormholes = decode(changes.wormholes, gm);
  if (changes.deaths) {
    const manager = gm.gameBoardPiecesManager;
    const kept = new Set(changes.deaths.keys);
    manager.deathPieces = manager.deathPieces.filter((death: any) => kept.has(death.key));
    changes.deaths.added.forEach((death: any) => {
      if (!manager.deathPieces.some((other: any) => other.key == death.key)) manager.deathPieces.push({ ...Object.fromEntries(Object.entries(death).map(([key, value]) => [key, decode(value, gm)])), body: undefined });
    });
  }
  if (changes.tiles) {
    const tiles = gm.gameBoardManager.getTilesInFlatArray();
    changes.tiles.forEach(([index, fields]) => {
      const tile = tiles[index];
      if (!tile) return;
      Object.entries(fields).forEach(([key, value]) => { tile[key] = decode(value, gm, tile[key]); });
    });
  }
};
