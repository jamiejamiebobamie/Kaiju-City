import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { THEMES } from "Utils/musicThemes";
import { getCurrentMusic, playMusicSting, previewMusic, setMusicIntensity, stopMusic } from "Utils/music";
import { AUDIO_LEVEL, setAudioVolume } from "Utils/audio";
import SAVED from "./musicReview.json";

/*
  The music review (Jamie, 2026-11-26; dev only, at /music): every theme, each in both styles (8-bit and not), with
  where it plays. Pick the style the game should use for it, and Approve / Redo / Cut it with a note; it all saves over
  musicReview.json, which the game reads for each theme's style (music.js getThemeStyle).
*/

const VERDICTS = [
  { id: "ok", label: "Approve", color: "#3fbf5f" },
  { id: "redo", label: "Redo", color: "#e0b030" },
  { id: "cut", label: "Cut", color: "#d24a4a" }
];
const STYLES = [{ id: "chip", label: "8-bit" }, { id: "synth", label: "Not 8-bit" }];

const Page = styled.div`
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
const Muted = styled.div`
  font-size: 14px;
  color: #9aa8b4;
`;
const Group = styled.h2`
  font-size: 16px;
  margin: 28px 0 8px;
  color: #8fd0ff;
`;
const Row = styled.div`
  display: grid;
  grid-template-columns: 250px 1fr 270px;
  gap: 16px;
  align-items: start;
  padding: 12px;
  border-radius: 8px;
  background: ${props => props.$color ? `${props.$color}18` : "#161c22"};
  border-left: 4px solid ${props => props.$color || "transparent"};
  margin-bottom: 6px;
`;
const Name = styled.div`
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 8px;
`;
const Buttons = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;
const Button = styled.button`
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid ${props => props.$color || "#3a4652"};
  background: ${props => props.$isOn ? (props.$color || "#2f6f9f") : "#1f2830"};
  color: ${props => props.$isOn && props.$color ? "#101418" : props.$color || "#d8e0e8"};
  font-weight: ${props => props.$color ? 600 : 400};
  cursor: pointer;
  font-size: 13px;
`;
const Context = styled.div`
  font-size: 14px;
  line-height: 1.4;
  color: #b8c4ce;
`;
const Judge = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
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

export const MusicReview = () => {
  const [review, setReview] = useState(SAVED || {});
  const [volume, setVolume] = useState(AUDIO_LEVEL.volume);
  const [playing, setPlaying] = useState(undefined); // { id, style, isLight, isTense }
  const [status, setStatus] = useState("");
  const saveTimer = useRef(undefined);

  useEffect(() => { setAudioVolume(volume); }, [volume]);
  useEffect(() => () => stopMusic(0.2), []);

  const update = (id, change) => {
    setReview(old => {
      const next = { ...old, [id]: { ...(old[id] || {}), ...change } };
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        fetch("/__music-review/save", { method: "POST", body: JSON.stringify(next) })
          .then(response => setStatus(response.ok ? "Saved" : "Not saved: is the dev server running?"))
          .catch(() => setStatus("Not saved: is the dev server running?"));
      }, 400);
      return next;
    });
  };

  const play = (id, style, extra = {}) => {
    const options = { isLight: !!extra.isLight, intensity: extra.isTense ? 1 : 0 };
    stopMusic(0.15);
    setTimeout(() => {
      previewMusic(id, style, options);
      setMusicIntensity(options.intensity);
    }, 160);
    setPlaying({ id, style, ...extra });
  };
  const stop = () => {
    stopMusic(0.4);
    setPlaying(undefined);
  };
  const isPlaying = (id, style) => playing && playing.id == id && playing.style == style && getCurrentMusic() !== undefined;

  const groups = [...new Set(Object.values(THEMES).map(theme => theme.group))];
  const counts = VERDICTS.map(({ id, label }) => `${label}: ${Object.keys(THEMES).filter(themeId => (review[themeId] || {}).verdict == id).length}`);

  return (
    <Page>
      <Top>
        <Title>Music review</Title>
        <Muted>{Object.keys(THEMES).length} themes · {counts.join(" · ")}</Muted>
        <label style={{ fontSize: 14 }}>
          Volume <input type="range" min={0} max={1} step={0.05} value={volume} onChange={event => setVolume(Number(event.target.value))} />
        </label>
        <Button onClick={stop}>■ Stop</Button>
        <Muted>{playing ? `Playing: ${THEMES[playing.id].name} (${playing.style == "chip" ? "8-bit" : "not 8-bit"}${playing.isLight ? ", light" : ""}${playing.isTense ? ", tense" : ""})` : ""}</Muted>
        <Muted>{status}</Muted>
      </Top>
      <Context style={{ maxWidth: 950, marginTop: 12 }}>
        Each theme loops until you press another or Stop. Every theme plays in both styles: pick the one the game should use
        ("Use"), then Approve, Redo (say what to change: faster, darker, a different tune, more like the other style…) or Cut.
        Battles also play "Light", the lighter take used for training and sparring; a few have "Tense", the layer that comes
        in when the scene heats up (the ghost rings, the flood, the glowing door).
      </Context>
      {groups.map(group => (
        <div key={group}>
          <Group>{group}</Group>
          {Object.entries(THEMES).filter(([, theme]) => theme.group == group).map(([id, theme]) => {
            const entry = review[id] || {};
            const verdict = VERDICTS.find(({ id: verdictId }) => verdictId == entry.verdict);
            const style = entry.style || "chip";
            return (
              <Row key={id} $color={verdict && verdict.color}>
                <div>
                  <Name>{theme.name}</Name>
                  <Buttons>
                    {STYLES.map(({ id: styleId, label }) => (
                      <Button key={styleId} $isOn={isPlaying(id, styleId) && !playing.isLight && !playing.isTense} onClick={() => play(id, styleId)}>▶ {label}</Button>
                    ))}
                  </Buttons>
                  {(group == "Battles" || theme.intense) && (
                    <Buttons style={{ marginTop: 6 }}>
                      {group == "Battles" && <Button $isOn={isPlaying(id, style) && playing.isLight} onClick={() => play(id, style, { isLight: true })}>▶ Light</Button>}
                      {theme.intense && <Button $isOn={isPlaying(id, style) && playing.isTense} onClick={() => play(id, style, { isTense: true })}>▶ Tense</Button>}
                    </Buttons>
                  )}
                  {id == "agent" && (
                    <Buttons style={{ marginTop: 6 }}>
                      <Button onClick={() => { stop(); setTimeout(() => playMusicSting("agent"), 200); }}>▶ Sting (an Agent shows)</Button>
                    </Buttons>
                  )}
                </div>
                <Context>{theme.context}</Context>
                <Judge>
                  <Buttons>
                    <Muted style={{ alignSelf: "center" }}>Use:</Muted>
                    {STYLES.map(({ id: styleId, label }) => (
                      <Button key={styleId} $isOn={style == styleId} onClick={() => update(id, { style: styleId })}>{label}</Button>
                    ))}
                  </Buttons>
                  <Buttons>
                    {VERDICTS.map(({ id: verdictId, label, color }) => (
                      <Button key={verdictId} style={{ flex: 1 }} $color={color} $isOn={entry.verdict == verdictId} onClick={() => update(id, { verdict: entry.verdict == verdictId ? undefined : verdictId })}>{label}</Button>
                    ))}
                  </Buttons>
                  <Note placeholder="Note (what to change)" value={entry.note || ""} onChange={event => update(id, { note: event.target.value })} />
                </Judge>
              </Row>
            );
          })}
        </div>
      ))}
    </Page>
  );
};
