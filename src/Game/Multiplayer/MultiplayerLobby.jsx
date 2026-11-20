import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { cleanRoomCode, getIsRoomCode, getJoinLink, getLinkedRoomCode, makeRoomCode, PeerLink } from "./peerLink";

/*
  Multiplayer's lobby (Jamie, 2026-11-19), on the monitor's start screen after Multiplayer: host a match (a room code
  and a link to send) or join one (the code typed in, or filled from the host's link). Once the two are linked,
  'onConnected' is given the link. Messages for each way it can go wrong, the service being down among them.
*/
const Panel = styled.div`
  position: absolute;
  left: 50%;
  top: 76%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1cqw;
  font-family: gameboy;
  color: #c8ffb8;
  text-shadow: 0 0 0.5cqw #3aff3a;
  text-align: center;
`;
const Row = styled.div`
  display: flex;
  gap: 1.5cqw;
  align-items: center;
`;
const LobbyButton = styled.button`
  padding: 0.7cqw 1.6cqw;
  font-size: 1.1cqw;
  letter-spacing: 0.15cqw;
  font-family: gameboy;
  color: #c8ffb8;
  background: #05030a;
  border: 0.18cqw solid #3aff3a;
  border-radius: 0.4cqw;
  text-shadow: 0 0 0.5cqw #3aff3a;
  box-shadow: 0 0 1cqw rgba(58, 255, 58, 0.4);
  cursor: pointer;
  outline: none;
  &:hover:not(:disabled) { background: #0f2a10; }
  &:disabled { color: #3e5a3a; border-color: #2a4a28; text-shadow: none; box-shadow: none; cursor: not-allowed; }
`;
const Code = styled.button`
  font-family: gameboy;
  color: #c8ffb8;
  text-shadow: 0 0 0.5cqw #3aff3a;
  cursor: pointer;
  outline: none;
  font-size: 2.6cqw;
  letter-spacing: 0.8cqw;
  padding: 0.4cqw 1.2cqw;
  border: 0.18cqw dashed #3aff3a;
  background: #05030a;
`;
const CodeInput = styled.input`
  width: 12cqw;
  padding: 0.5cqw 0.8cqw;
  font-family: gameboy;
  font-size: 1.8cqw;
  letter-spacing: 0.5cqw;
  text-align: center;
  text-transform: uppercase;
  color: #c8ffb8;
  background: #05030a;
  border: 0.18cqw solid #3aff3a;
  border-radius: 0.4cqw;
  outline: none;
`;
const Message = styled.div`
  font-size: 0.9cqw;
  letter-spacing: 0.08cqw;
  min-height: 1.2cqw;
  color: ${props => (props.$isProblem ? "#ab4840" : "#9fd894")};
  text-shadow: ${props => (props.$isProblem ? "0 0 0.3cqw rgba(171, 72, 64, 0.3)" : "none")};
`;

const STATUS_TEXT = {
  starting: "Starting...",
  waiting: "Waiting for a player to join...",
  connecting: "Connecting...",
  connected: "Connected!",
  closed: "The connection closed.",
  down: "The multiplayer service is currently down. Try again later.",
  noRoom: "No match with that code. Check it and try again.",
  taken: "That room is taken. Try hosting again."
};
const PROBLEMS = ["closed", "down", "noRoom", "taken"];
const CONNECTED_HOLD_MS = 900; // ("Connected!" seen before the match setup)

export const MultiplayerLobby = ({ onBack, onConnected }) => {
  const linkedCode = useRef(getLinkedRoomCode());
  const [screen, setScreen] = useState(linkedCode.current ? "join" : "choose"); // choose, host, join
  const [code, setCode] = useState(linkedCode.current || "");
  const [status, setStatus] = useState(undefined);
  const [isCopied, setIsCopied] = useState(false);
  const [isCodeCopied, setIsCodeCopied] = useState(false); // (the code itself, clicked: Jamie)
  const link = useRef(undefined);
  const messages = useRef([]); // (any said before the match setup takes over: handed on with the link)

  const stop = () => {
    if (link.current) link.current.close();
    link.current = undefined;
    setStatus(undefined);
  };
  useEffect(() => () => { if (link.current && link.current.status != "connected") link.current.close(); }, []);

  const begin = (role, roomCode) => {
    stop();
    const next = new PeerLink(role, roomCode, {
      onStatus: setStatus,
      onMessage: message => messages.current.push(message)
    });
    link.current = next;
    next.start();
  };
  useEffect(() => {
    if (status != "connected") return;
    const timer = setTimeout(() => onConnected(link.current, messages.current), CONNECTED_HOLD_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const host = () => {
    const roomCode = makeRoomCode();
    setCode(roomCode);
    setScreen("host");
    begin("host", roomCode);
  };
  const copyLink = () => {
    try {
      navigator.clipboard.writeText(getJoinLink(code));
      setIsCopied(true);
    } catch { /* (no clipboard: the code is there to read out) */ }
  };
  const copyCode = () => {
    try {
      navigator.clipboard.writeText(code);
      setIsCodeCopied(true);
      setTimeout(() => setIsCodeCopied(false), 1500);
    } catch { /* (no clipboard) */ }
  };
  const back = () => {
    stop();
    setCode(""); // (cleared: Jamie)
    if (screen == "choose") onBack();
    else setScreen("choose");
  };
  const isBusy = status == "starting" || status == "connecting" || status == "connected";

  return (
    <Panel onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
      {screen == "choose" && (
        <Row>
          <LobbyButton onClick={host}>Host a match</LobbyButton>
          <LobbyButton onClick={() => { setScreen("join"); setStatus(undefined); }}>Join a match</LobbyButton>
        </Row>
      )}
      {screen == "host" && (
        <>
          <div style={{ fontSize: "0.9cqw" }}>{isCodeCopied ? "Copied!" : "Room code: click to copy"}</div>
          <Code onClick={copyCode} title="Copy">{code}</Code>
          <Row>
            <LobbyButton onClick={copyLink} disabled={status != "waiting"}>{isCopied ? "Link copied" : "Copy join link"}</LobbyButton>
          </Row>
        </>
      )}
      {screen == "join" && (
        <>
          <div style={{ fontSize: "0.9cqw" }}>Enter the host's room code</div>
          <Row>
            <CodeInput value={code} maxLength={5} autoFocus spellCheck={false} onMouseDown={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()} onClick={event => event.currentTarget.focus()} onChange={event => setCode(cleanRoomCode(event.target.value))} onKeyDown={event => { if (event.key == "Enter" && getIsRoomCode(code) && !isBusy) begin("guest", code); }} />
            <LobbyButton disabled={!getIsRoomCode(code) || isBusy} onClick={() => begin("guest", code)}>Join</LobbyButton>
          </Row>
        </>
      )}
      <Message $isProblem={PROBLEMS.includes(status)}>{status ? STATUS_TEXT[status] : ""}</Message>
      <LobbyButton onClick={back} disabled={status == "connected"}>Back</LobbyButton>
    </Panel>
  );
};
