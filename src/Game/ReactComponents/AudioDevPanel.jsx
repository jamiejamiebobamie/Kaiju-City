import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { AUDIO_LEVEL, setMusicOff, setSfxOff } from "Utils/audio";
import { getCurrentMusicInfo, MUSIC_REVIEW, MUSIC_STYLE_OVERRIDE, refreshMusicStyle } from "Utils/music";
import { THEMES } from "Utils/musicThemes";
import { getRecentSfx, getSoundName, onRecentSfx } from "Utils/sfx";

/*
  Dev only (Jamie, 2026-11-26): the sound in the game, to judge it where it plays:
  - the music on or off, the sound effects (and the loops under the scene) on or off;
  - every theme 8-bit, or none 8-bit, or each its own pick from /music;
  - the theme playing now, and a sound just heard: Approve, Redo or Cut, with a note for Claude. Saved into
    musicReview.json and soundReview.json, as /music and /sounds save them.
*/

const VERDICTS = [
  { id: "ok", label: "Approve", color: "#3fbf5f" },
  { id: "redo", label: "Redo", color: "#e0b030" },
  { id: "cut", label: "Cut", color: "#d24a4a" }
];
const STYLE_CHOICES = [{ value: "", label: "each its /music pick" }, { value: "chip", label: "all 8-bit" }, { value: "synth", label: "all not 8-bit" }];

const Panel = styled.div`
  position: fixed;
  left: 8px;
  bottom: 8px;
  z-index: 2147483000;
  width: 300px;
  padding: 8px 10px;
  background: rgba(8, 12, 16, 0.92);
  border: 1px solid #2f6f4f;
  border-radius: 6px;
  color: #cfe8d8;
  font: 12px/1.35 monospace;
  display: flex;
  flex-direction: column;
  gap: 6px;
  & button { font: inherit; cursor: pointer; }
`;
const Row = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
`;
const Verdict = styled.button`
  flex: 1;
  padding: 2px 0;
  border-radius: 4px;
  border: 1px solid ${props => props.$color};
  background: ${props => props.$isOn ? props.$color : "transparent"};
  color: ${props => props.$isOn ? "#081010" : props.$color};
`;
const Note = styled.textarea`
  background: #05080a;
  color: #cfe8d8;
  border: 1px solid #2a3a32;
  border-radius: 4px;
  font: inherit;
  min-height: 32px;
  resize: vertical;
`;
const Title = styled.div`
  color: #6dffa0;
`;

// read the review's file, change one entry, write it back (the review page may have changed it since)
const saveEntry = async (name, id, change) => {
  try {
    const current = await (await fetch(`/__${name}/load`)).json();
    const next = { ...current, [id]: { ...(current[id] || {}), ...change } };
    const response = await fetch(`/__${name}/save`, { method: "POST", body: JSON.stringify(next) });
    return response.ok ? next : undefined;
  } catch {
    return undefined;
  }
};

const Judge = ({ name, id, entry, onSaved }) => {
  const [note, setNote] = useState(entry.note || "");
  useEffect(() => setNote(entry.note || ""), [id]);
  const save = async change => {
    const next = await saveEntry(name, id, change);
    onSaved(next ? next[id] : undefined);
  };
  return (
    <>
      <Row>
        {VERDICTS.map(({ id: verdict, label, color }) => (
          <Verdict key={verdict} data-sfx="none" $color={color} $isOn={entry.verdict == verdict} onClick={() => save({ verdict: entry.verdict == verdict ? undefined : verdict, note })}>{label}</Verdict>
        ))}
      </Row>
      <Note placeholder="Note for Claude (what to change)" value={note} onChange={event => setNote(event.target.value)} onBlur={() => note != (entry.note || "") && save({ note })} onKeyDown={event => event.stopPropagation()} />
    </>
  );
};

export const AudioDevPanel = () => {
  const [, setTick] = useState(0);
  const refresh = () => setTick(tick => tick + 1);
  const [isOpen, setIsOpen] = useState(true);
  const [soundEntries, setSoundEntries] = useState({});
  const [soundId, setSoundId] = useState(undefined);
  const [recent, setRecent] = useState(getRecentSfx);
  const [status, setStatus] = useState("");
  useEffect(() => {
    const timer = setInterval(refresh, 700); // (what's playing changes with the scene)
    const off = onRecentSfx(() => setRecent(getRecentSfx()));
    fetch("/__sound-review/load").then(response => response.json()).then(setSoundEntries).catch(() => {});
    return () => { clearInterval(timer); off(); };
  }, []);
  const music = getCurrentMusicInfo();
  const theme = music && THEMES[music.id];
  // (held on the one picked, or the first heard: it doesn't jump with every footstep)
  useEffect(() => { if (!soundId && recent[0]) setSoundId(recent[0]); }, [recent]);
  const shownSound = soundId;

  if (!isOpen) return <Panel style={{ width: "auto" }}><button data-sfx="none" onClick={() => setIsOpen(true)}>Sound (dev)</button></Panel>;
  return (
    <Panel onPointerDown={event => event.stopPropagation()}>
      <Row style={{ justifyContent: "space-between" }}>
        <Title>Sound (dev)</Title>
        <button data-sfx="none" onClick={() => setIsOpen(false)}>hide</button>
      </Row>
      <Row>
        <label><input type="checkbox" checked={!AUDIO_LEVEL.isMusicOff} onChange={event => { setMusicOff(!event.target.checked); refresh(); event.target.blur(); }} /> Music</label>
        <label><input type="checkbox" checked={!AUDIO_LEVEL.isSfxOff} onChange={event => { setSfxOff(!event.target.checked); refresh(); event.target.blur(); }} /> Sound effects</label>
      </Row>
      <Row>
        Style:
        <select value={MUSIC_STYLE_OVERRIDE.value || ""} onChange={event => { MUSIC_STYLE_OVERRIDE.value = event.target.value || undefined; refreshMusicStyle(); refresh(); event.target.blur(); }}>
          {STYLE_CHOICES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select>
      </Row>
      <Title>Music: {theme ? `${theme.name} (${music.style == "chip" ? "8-bit" : "not 8-bit"}${music.isLight ? ", light" : ""}${music.intensity ? ", tense" : ""})` : "none"}</Title>
      {theme && (
        <Judge name="music-review" id={music.id} entry={MUSIC_REVIEW[music.id] || {}} onSaved={entry => {
          setStatus(entry ? "Saved" : "Not saved: is the dev server running?");
          if (entry) MUSIC_REVIEW[music.id] = entry;
        }} />
      )}
      <Title>Sound: {shownSound ? getSoundName(shownSound) : "none heard yet"}</Title>
      {recent.length > 0 && (
        <select value={shownSound} onChange={event => { setSoundId(event.target.value); event.target.blur(); }}>
          {[...new Set([shownSound, ...recent])].filter(Boolean).map(id => <option key={id} value={id}>{id == shownSound ? "" : "heard: "}{getSoundName(id)}</option>)}
        </select>
      )}
      {shownSound && (
        <Judge name="sound-review" id={shownSound} entry={soundEntries[shownSound] || {}} onSaved={entry => {
          setStatus(entry ? "Saved" : "Not saved: is the dev server running?");
          if (entry) setSoundEntries(entries => ({ ...entries, [shownSound]: entry }));
        }} />
      )}
      {status && <div style={{ color: "#8aa" }}>{status}</div>}
    </Panel>
  );
};
