import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { SOUNDS, SFX_VOLUME, playSfx } from "Utils/sfx";
import SAVED from "./soundReview.json";

/*
  The sound review (Jamie, 2026-11-25; dev only, at /sounds): every proposed sound effect, with where it plays, to hear
  and judge before any goes into the game. Approve, Redo (say what to change in the note) or Cut each one; the
  verdicts and notes save over soundReview.json, for Claude to read.
*/

const VERDICTS = [
  { id: "ok", label: "Approve", color: "#3fbf5f" },
  { id: "redo", label: "Redo", color: "#e0b030" },
  { id: "cut", label: "Cut", color: "#d24a4a" }
];

const Page = styled.div`
  /* (the game's page doesn't scroll: App.css. This one scrolls itself) */
  height: 100vh;
  overflow-y: auto;
  background: #101418;
  color: #d8e0e8;
  font-family: system-ui, sans-serif;
  padding: 0 32px 80px;
  box-sizing: border-box;
`;
const Top = styled.div`
  position: sticky;
  top: 0;
  z-index: 2;
  background: #101418;
  padding: 24px 0 12px;
  display: flex;
  gap: 20px;
  align-items: center;
  flex-wrap: wrap;
  border-bottom: 1px solid #2a323a;
`;
const Title = styled.h1`
  font-size: 22px;
  margin: 0;
`;
const Counts = styled.div`
  font-size: 14px;
  color: #9aa8b4;
`;
const Group = styled.h2`
  font-size: 16px;
  margin: 28px 0 8px;
  color: #8fd0ff;
  display: flex;
  gap: 12px;
  align-items: center;
`;
const Row = styled.div`
  display: grid;
  grid-template-columns: 56px 220px 1fr 250px;
  gap: 14px;
  align-items: start;
  padding: 10px 12px;
  border-radius: 8px;
  background: ${props => props.$color ? `${props.$color}18` : "#161c22"};
  border-left: 4px solid ${props => props.$color || "transparent"};
  margin-bottom: 6px;
`;
const PlayButton = styled.button`
  width: 48px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid #3a4652;
  background: ${props => props.$isPlaying ? "#2f6f9f" : "#1f2830"};
  color: #fff;
  font-size: 16px;
  cursor: pointer;
`;
const Name = styled.div`
  font-weight: 600;
  font-size: 15px;
  padding-top: 7px;
`;
const Context = styled.div`
  font-size: 14px;
  line-height: 1.4;
  color: #b8c4ce;
  padding-top: 7px;
`;
const Judge = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;
const Verdicts = styled.div`
  display: flex;
  gap: 6px;
`;
const VerdictButton = styled.button`
  flex: 1;
  padding: 6px 0;
  border-radius: 6px;
  border: 1px solid ${props => props.$color};
  background: ${props => props.$isOn ? props.$color : "transparent"};
  color: ${props => props.$isOn ? "#101418" : props.$color};
  font-weight: 600;
  cursor: pointer;
`;
const Note = styled.textarea`
  background: #0c1014;
  color: #d8e0e8;
  border: 1px solid #2a323a;
  border-radius: 6px;
  font: inherit;
  font-size: 13px;
  padding: 6px;
  resize: vertical;
  min-height: 30px;
`;
const SmallButton = styled.button`
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #3a4652;
  background: #1f2830;
  color: #d8e0e8;
  cursor: pointer;
  font-size: 13px;
`;

const getLongestMs = () => 4500; // (no sound runs longer than ~4 s)

export const SoundReview = () => {
  const [review, setReview] = useState(SAVED || {});
  const [volume, setVolume] = useState(SFX_VOLUME.value);
  const [playing, setPlaying] = useState(undefined);
  const [status, setStatus] = useState("");
  const saveTimer = useRef(undefined);
  const stopGroup = useRef(false);

  useEffect(() => { SFX_VOLUME.value = volume; }, [volume]);

  // saved a moment after each change
  const update = (id, change) => {
    setReview(old => {
      const next = { ...old, [id]: { ...(old[id] || {}), ...change } };
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        fetch("/__sound-review/save", { method: "POST", body: JSON.stringify(next) })
          .then(response => setStatus(response.ok ? "Saved" : "Not saved: is the dev server running?"))
          .catch(() => setStatus("Not saved: is the dev server running?"));
      }, 400);
      return next;
    });
  };

  const play = id => {
    playSfx(id);
    setPlaying(id);
    setTimeout(() => setPlaying(current => (current == id ? undefined : current)), 600);
  };
  const playGroup = async ids => {
    stopGroup.current = false;
    for (const id of ids) {
      if (stopGroup.current) return;
      play(id);
      await new Promise(resolve => setTimeout(resolve, getLongestMs() * 0.6));
    }
  };

  const groups = [...new Set(SOUNDS.map(sound => sound.group))];
  const counts = VERDICTS.map(({ id, label }) => `${label}: ${SOUNDS.filter(sound => (review[sound.id] || {}).verdict == id).length}`);
  const undecided = SOUNDS.filter(sound => !(review[sound.id] || {}).verdict).length;

  return (
    <Page>
      <Top>
        <Title>Sound review</Title>
        <Counts>{SOUNDS.length} sounds · {counts.join(" · ")} · Not yet: {undecided}</Counts>
        <label style={{ fontSize: 14 }}>
          Volume <input type="range" min={0} max={1} step={0.05} value={volume} onChange={event => setVolume(Number(event.target.value))} />
        </label>
        <SmallButton onClick={() => { stopGroup.current = true; }}>Stop the play-through</SmallButton>
        <Counts>{status}</Counts>
      </Top>
      <Context style={{ maxWidth: 900, marginTop: 12 }}>
        Each sound is made in code (no files), so a Redo is quick: say what to change in its note (lower, shorter, more bass,
        less harsh, "like X"). Your verdicts and notes save as you go. The ones marked "would loop" play a few seconds here; in
        the game they'd run quietly under the scene. Music (the landing theme, level loops, the boss theme, credits) isn't here.
      </Context>
      {groups.map(group => {
        const sounds = SOUNDS.filter(sound => sound.group == group);
        return (
          <div key={group}>
            <Group>
              {group}
              <SmallButton onClick={() => playGroup(sounds.map(({ id }) => id))}>Play all {sounds.length}</SmallButton>
            </Group>
            {sounds.map(sound => {
              const entry = review[sound.id] || {};
              const verdict = VERDICTS.find(({ id }) => id == entry.verdict);
              return (
                <Row key={sound.id} $color={verdict && verdict.color}>
                  <PlayButton $isPlaying={playing == sound.id} onClick={() => play(sound.id)} title="Play">▶</PlayButton>
                  <Name>{sound.name}</Name>
                  <Context>{sound.context}</Context>
                  <Judge>
                    <Verdicts>
                      {VERDICTS.map(({ id, label, color }) => (
                        <VerdictButton key={id} $color={color} $isOn={entry.verdict == id} onClick={() => update(sound.id, { verdict: entry.verdict == id ? undefined : id })}>{label}</VerdictButton>
                      ))}
                    </Verdicts>
                    <Note placeholder="Note (what to change, where else to use it)" value={entry.note || ""} onChange={event => update(sound.id, { note: event.target.value })} />
                  </Judge>
                </Row>
              );
            })}
          </div>
        );
      })}
    </Page>
  );
};
