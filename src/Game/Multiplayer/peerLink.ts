import Peer, { DataConnection } from 'peerjs';

/*
  Multiplayer's link between two browsers (Jamie, 2026-11-18): PeerJS, no server of our own. PeerJS's free public
  server only introduces the two browsers (the handshake); the match itself goes browser to browser.
  The host makes a room: a short code, which the guest types in (or opens the host's link, ?join=CODE).
  checkPeerService: whether PeerJS's server is up (Jamie: check it before offering Multiplayer, and say so if it's down).
*/
const PEER_SERVER = 'https://0.peerjs.com';
const ID_PREFIX = 'kaiju-city-';
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // (no 0/O or 1/I to mix up)
const CODE_LENGTH = 5;
const CHECK_TIMEOUT_MS = 4000;

let serviceCheck: Promise<boolean> | undefined;
// (asked once a visit: the start screen's Multiplayer button waits on it; 'isFresh' asks again)
export const checkPeerService = (isFresh = false): Promise<boolean> => {
  if (serviceCheck && !isFresh) return serviceCheck;
  serviceCheck = (async () => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), CHECK_TIMEOUT_MS);
    try {
      const response = await fetch(`${PEER_SERVER}/peerjs/id?ts=${Date.now()}`, { signal: abort.signal, cache: 'no-store' });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  })();
  return serviceCheck;
};

export const makeRoomCode = () => [...Array(CODE_LENGTH)].map(() => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
export const cleanRoomCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
export const getIsRoomCode = (code: string) => cleanRoomCode(code).length == CODE_LENGTH;
export const getJoinLink = (code: string) => `${window.location.origin}/home?join=${code}`;
// (a guest who opened the host's link: its code. Read as the page loads: the redirect to /home drops the query
// (Jamie: the link did nothing))
const LINKED_CODE = typeof window != 'undefined' ? new URLSearchParams(window.location.search).get('join') : null;
export const getLinkedRoomCode = () => {
  const code = LINKED_CODE || new URLSearchParams(window.location.search).get('join');
  return code && getIsRoomCode(code) ? cleanRoomCode(code) : undefined;
};

export type LinkStatus = 'starting' | 'waiting' | 'connecting' | 'connected' | 'closed' | 'down' | 'noRoom' | 'taken';
export type LinkRole = 'host' | 'guest';

type LinkEvents = {
  onStatus: (status: LinkStatus) => void;
  onMessage: (message: any) => void;
};

export class PeerLink {
  role: LinkRole;
  code: string;
  status: LinkStatus = 'starting';
  private peer: Peer | undefined;
  private connection: DataConnection | undefined;
  private events: LinkEvents;


  constructor(role: LinkRole, code: string, events: LinkEvents) {
    this.role = role;
    this.code = cleanRoomCode(code);
    this.events = events;
  }

  private setStatus(status: LinkStatus) {
    if (this.status == status) return;
    this.status = status;
    this.events.onStatus(status);
  }

  private useConnection(connection: DataConnection) {
    if (this.connection && this.connection !== connection) {
      connection.close(); // (one guest to a room)
      return;
    }
    this.connection = connection;
    connection.on('open', () => this.setStatus('connected'));
    connection.on('data', data => this.events.onMessage(data));
    connection.on('close', () => { this.connection = undefined; this.setStatus('closed'); });
    connection.on('error', () => this.setStatus('closed'));
  }

  start() {
    // the host's id is the room's; the guest takes any id and calls the host's
    this.peer = this.role == 'host' ? new Peer(ID_PREFIX + this.code) : new Peer();
    this.peer.on('open', () => {
      if (this.role == 'host') {
        this.setStatus('waiting');
        return;
      }
      this.setStatus('connecting');
      this.useConnection(this.peer!.connect(ID_PREFIX + this.code, { reliable: true }));
    });
    if (this.role == 'host') this.peer.on('connection', connection => this.useConnection(connection));
    this.peer.on('error', (error: any) => {
      const type = error && error.type;
      if (type == 'peer-unavailable') this.setStatus('noRoom');
      else if (type == 'unavailable-id') this.setStatus('taken');
      else if (['network', 'server-error', 'socket-error', 'socket-closed', 'browser-incompatible'].includes(type)) this.setStatus('down');
      else this.setStatus('closed');
    });
    // (the PeerJS server lost: an open match carries on browser to browser; one not yet joined can't be)
    this.peer.on('disconnected', () => { if (this.status != 'connected') this.setStatus('down'); });
  }

  // (the lobby's handlers handed over to the match's)
  setEvents(events: LinkEvents) {
    this.events = events;
  }

  send(message: any) {
    if (this.connection && this.connection.open) this.connection.send(message);
  }

  getIsOpen() {
    return !!this.connection && this.connection.open;
  }

  close() {
    if (this.connection) this.connection.close();
    if (this.peer) this.peer.destroy();
    this.connection = undefined;
    this.peer = undefined;
  }
}
