import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { TILE_STATUSES_AND_ABILITY_DATA } from "Utils/gameState";
import DIALOGUE from "Game/DataClasses/Dialogue/dialogue.json";
import { DEFAULT_PATH, getIsBranchingSection, getSectionItems, RIVALS, STORY } from "./storyPath";

/*
  /dialogue (dev only): every line in the game, in story order, one path at a time.
  The bar at the top sets the path: the player's avatar, a power, and what they did with each bystander.
  Where lines depend on a choice, a branch shows the path's version and can open to show them all.

  Keys: up/down a line, Page Up/Down a section, N/P the next or previous branch,
  left/right a branch's versions, Enter opens a branch, Esc closes it (back up to the parent).
  The panel on the right edits the selected line; Save (or Ctrl+S) writes dialogue.json through the dev server.
*/

// who can say a line: the roles the game fills in, and the people met by name
const SPEAKERS = [
  ["player", "The player (Guy or Girl)"], ["teammate", "The teammate (the other one)"], ["agent", "Agent"], ["recruit", "A recruit"],
  ["Punk Guy", "Punk Guy"], ["Punk Girl", "Punk Girl"], ["Aquarium Worker", "Aquarium Worker"], ["Lab Tech", "Lab Tech"]
];

// the scenes whose lines each get a camera shot: the bystander intros, the walk-ins, the showdown and the trap
const getHasShots = sceneId => /\.intro$|\.walkIn$|\.showdown$|^labTrap\.trap$/.test(sceneId);

const PRONOUN_WORDS = ["{you:he}", "{you:him}", "{you:his}", "{teammate:he}", "{teammate:him}", "{teammate:his}"];

// a line by its id, anywhere in a scene: in its lines, or in the replies to a choice
const findLine = (lines, id) => {
  for (let index = 0; index < lines.length; index++) {
    if (lines[index].id == id) return { list: lines, index };
    for (const choice of lines[index].choices || []) {
      const found = findLine(choice.reply, id);
      if (found) return found;
    }
  }
  return undefined;
};
const LOOK = {
  bg: "#0d1117",
  panel: "#161b22",
  line: "#21262d",
  text: "#e6edf3",
  dim: "#8b949e",
  accent: "#6dffa0",
  branch: "#d29922",
  selected: "#1f6feb"
};

const Page = styled.div`
  position: fixed;
  inset: 0;
  display: grid;
  grid-template-columns: 240px 1fr 340px;
  grid-template-rows: auto 1fr;
  font-family: system-ui, sans-serif;
  font-size: 14px;
  color: ${LOOK.text};
  background: ${LOOK.bg};
`;

const TopBar = styled.div`
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: ${LOOK.panel};
  border-bottom: 1px solid ${LOOK.line};
  & select, & input { background: ${LOOK.bg}; color: ${LOOK.text}; border: 1px solid ${LOOK.line}; padding: 3px 6px; }
`;

const Crumbs = styled.div`
  flex-basis: 100%;
  color: ${LOOK.dim};
  & button { background: none; border: none; color: ${LOOK.accent}; cursor: pointer; padding: 0 2px; font: inherit; }
`;

const Timeline = styled.nav`
  overflow-y: auto;
  border-right: 1px solid ${LOOK.line};
  padding: 8px 0;
`;

const TimelineItem = styled.button`
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 14px;
  border: none;
  font: inherit;
  cursor: pointer;
  color: ${props => props.$isEmpty ? LOOK.dim : LOOK.text};
  background: ${props => props.$isCurrent ? LOOK.line : "none"};
  border-left: 3px solid ${props => props.$isCurrent ? LOOK.accent : "transparent"};
`;

const Script = styled.main`
  overflow-y: auto;
  padding: 0 24px 40vh;
`;

const SectionHeader = styled.h2`
  position: sticky;
  top: 0;
  z-index: 1;
  margin: 0;
  padding: 12px 0 8px;
  font-size: 15px;
  color: ${LOOK.accent};
  background: ${LOOK.bg};
  border-bottom: 1px solid ${LOOK.line};
`;

const SceneLabel = styled.div`
  margin: 14px 0 4px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${LOOK.dim};
`;

const LineRow = styled.div`
  display: grid;
  grid-template-columns: ${props => props.$isCompact ? "1fr" : "150px 1fr"};
  gap: ${props => props.$isCompact ? "1px" : "12px"};
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  background: ${props => props.$isSelected ? "rgba(31, 111, 235, 0.25)" : "none"};
  outline: ${props => props.$isSelected ? `1px solid ${LOOK.selected}` : "none"};
  opacity: ${props => props.$isMatch === false ? 0.3 : 1};
`;

const Speaker = styled.div`
  color: ${LOOK.dim};
  font-weight: 600;
  text-align: ${props => props.$isCompact ? "left" : "right"};
  font-size: ${props => props.$isCompact ? "12px" : "inherit"};
`;

const Tag = styled.span`
  margin-left: 6px;
  padding: 0 5px;
  border-radius: 3px;
  font-size: 11px;
  color: ${LOOK.bg};
  background: ${props => props.$color || LOOK.dim};
`;

const Branch = styled.div`
  margin: 6px 0;
  padding: 6px 8px;
  border-left: 3px solid ${LOOK.branch};
  border-radius: 4px;
  background: ${props => props.$isSelected ? "rgba(210, 153, 34, 0.18)" : "rgba(210, 153, 34, 0.06)"};
  outline: ${props => props.$isSelected ? `1px solid ${LOOK.branch}` : "none"};
`;

const BranchHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: ${LOOK.branch};
  font-weight: 600;
`;

const Versions = styled.div`
  display: grid;
  grid-template-columns: repeat(${props => props.$count}, minmax(220px, 1fr));
  gap: 10px;
  margin-top: 8px;
  overflow-x: auto;
`;

const Version = styled.div`
  padding: 6px;
  border-radius: 4px;
  border: 1px solid ${props => props.$isTaken ? LOOK.branch : LOOK.line};
  background: ${props => props.$isShown ? "rgba(210, 153, 34, 0.08)" : "none"};
`;

const VersionLabel = styled.button`
  display: block;
  margin-bottom: 4px;
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  color: ${props => props.$isTaken ? LOOK.branch : LOOK.dim};
`;

const Side = styled.aside`
  overflow-y: auto;
  padding: 14px;
  border-left: 1px solid ${LOOK.line};
  background: ${LOOK.panel};
  & dt { color: ${LOOK.dim}; font-size: 12px; margin-top: 10px; }
  & dd { margin: 2px 0 0; }
  & textarea, & select { width: 100%; box-sizing: border-box; background: ${LOOK.bg}; color: ${LOOK.text}; border: 1px solid ${LOOK.line}; padding: 5px; font: inherit; }
  & textarea { min-height: 90px; resize: vertical; }
`;

const ButtonRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  & button { background: ${LOOK.line}; color: ${LOOK.text}; border: 1px solid #30363d; border-radius: 4px; padding: 4px 8px; cursor: pointer; font: inherit; font-size: 12px; }
  & button:hover { border-color: ${LOOK.accent}; }
  & button[data-danger]:hover { border-color: #ff6b6b; color: #ff6b6b; }
`;

const SaveButton = styled.button`
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid ${props => props.disabled ? LOOK.line : LOOK.accent};
  color: ${props => props.disabled ? LOOK.dim : LOOK.bg};
  background: ${props => props.disabled ? "none" : LOOK.accent};
  cursor: ${props => props.disabled ? "default" : "pointer"};
  font: inherit;
  font-weight: 600;
`;

const Keys = styled.div`
  margin-top: 24px;
  font-size: 12px;
  color: ${LOOK.dim};
  line-height: 1.7;
`;

const POWER_NAMES = TILE_STATUSES_AND_ABILITY_DATA.map(({ activeName }) => activeName).filter(Boolean);

// a line's look in the script
// 'isCompact': in a branch's narrow version columns, the speaker sits over the words
const LineView = ({ item, isSelected, isMatch, onSelect, refFor, isCompact = false }) => (
  <LineRow ref={refFor(item.key)} $isSelected={isSelected} $isMatch={isMatch} $isCompact={isCompact} onClick={() => onSelect(item.key)}>
    <Speaker $isCompact={isCompact}>{item.speakerName}</Speaker>
    <div>
      {item.text}
      {item.tags.map(tag => <Tag key={tag} $color={tag == "Jamie" ? LOOK.accent : tag == "siren" ? "#ff6b6b" : undefined}>{tag}</Tag>)}
    </div>
  </LineRow>
);

export const DialogueViewer = () => {
  const [dialogue, setDialogue] = useState(() => structuredClone(DIALOGUE));
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(DIALOGUE));
  const [saveNote, setSaveNote] = useState("");
  const isDirty = JSON.stringify(dialogue) != savedJson;
  const scenes = dialogue.scenes;
  const [path, setPath] = useState(DEFAULT_PATH);
  const [selectedKey, setSelectedKey] = useState(undefined);
  const [openBranches, setOpenBranches] = useState(() => new Set());
  const [shownVersions, setShownVersions] = useState({}); // a branch's version picked to read, other than the path's
  const [search, setSearch] = useState("");
  const rowRefs = useRef({});
  const sectionRefs = useRef([]);
  const refFor = key => element => { rowRefs.current[key] = element; };

  const sections = useMemo(() => STORY.map((section, index) => ({ ...section, index, items: getSectionItems(index, path, scenes), isBranching: getIsBranchingSection(index, scenes) })), [path, scenes]);

  // every edit works on a fresh copy of the dialogue: (scenes) => change them in place
  const editDialogue = change => setDialogue(current => {
    const next = structuredClone(current);
    change(next.scenes);
    return next;
  });
  const updateLine = (sceneId, lineId, patch) => editDialogue(all => {
    const found = findLine(all[sceneId].lines, lineId);
    if (!found) return;
    const line = found.list[found.index];
    Object.entries(patch).forEach(([field, value]) => {
      if (value === undefined) delete line[field];
      else line[field] = value;
    });
  });
  const deleteLine = (sceneId, lineId) => {
    editDialogue(all => {
      const found = findLine(all[sceneId].lines, lineId);
      if (found) found.list.splice(found.index, 1);
    });
    goTo(Math.max(selectedIndex - 1, 0));
  };
  // a new line after this one, in the same branch: same speaker and conditions, for you to change
  const addLineAfter = (sceneId, lineId) => {
    const id = `${sceneId}.x${Date.now().toString(36)}`;
    editDialogue(all => {
      const found = findLine(all[sceneId].lines, lineId);
      if (!found) return;
      const { speaker, when, isBalloon, ifRecruits } = found.list[found.index];
      found.list.splice(found.index + 1, 0, { speaker: speaker || "agent", text: "New line", ...(when ? { when } : {}), ...(isBalloon ? { isBalloon } : {}), ...(ifRecruits ? { ifRecruits } : {}), id });
    });
    const branchKey = selected && selected.branch ? `${selected.branch.key}/` : "";
    setSelectedKey(`${branchKey}${id}`);
  };
  const save = async () => {
    setSaveNote("Saving...");
    try {
      const response = await fetch("/__dialogue/save", { method: "POST", body: JSON.stringify(dialogue) });
      if (!response.ok) throw new Error(await response.text());
      setSavedJson(JSON.stringify(dialogue));
      setSaveNote("Saved to dialogue.json. Reload the game to hear it.");
    } catch (error) {
      setSaveNote(`Not saved: ${error.message}`);
    }
  };

  // everything that can be selected, top to bottom: lines, and branch heads (with the lines of the version shown)
  const order = useMemo(() => sections.flatMap(({ index, items }) => items.flatMap(item => {
    if (item.kind == "line") return [{ key: item.key, section: index, item }];
    const shown = shownVersions[item.key] ?? item.taken;
    const version = item.versions[Math.max(shown, 0)];
    return [{ key: item.key, section: index, item, isBranch: true }, ...(version ? version.items.map(line => ({ key: `${item.key}/${line.key}`, section: index, item: line, branch: item })) : [])];
  })), [sections, shownVersions]);

  const selectedIndex = order.findIndex(({ key }) => key == selectedKey);
  const selected = order[selectedIndex];
  const currentSection = selected ? selected.section : 0;

  useEffect(() => {
    const row = rowRefs.current[selectedKey];
    if (row) row.scrollIntoView({ block: "nearest" });
  }, [selectedKey]);

  const goTo = index => { if (order[index]) setSelectedKey(order[index].key); };
  const goToSection = sectionIndex => {
    const first = order.find(({ section }) => section == sectionIndex);
    if (first) setSelectedKey(first.key);
    else if (sectionRefs.current[sectionIndex]) sectionRefs.current[sectionIndex].scrollIntoView({ block: "start" });
  };
  const getBranchOf = entry => entry && (entry.isBranch ? entry.item : entry.branch);

  useEffect(() => {
    const onKey = event => {
      if ((event.ctrlKey || event.metaKey) && event.code == "KeyS") {
        event.preventDefault();
        if (isDirty) save();
        return;
      }
      if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
      const branch = getBranchOf(selected);
      const moves = {
        ArrowDown: () => goTo(selectedIndex + 1),
        ArrowUp: () => goTo(Math.max(selectedIndex - 1, 0)),
        PageDown: () => goToSection(Math.min(currentSection + 1, STORY.length - 1)),
        PageUp: () => goToSection(Math.max(currentSection - 1, 0)),
        KeyN: () => goTo(order.findIndex((entry, index) => index > selectedIndex && entry.isBranch)),
        KeyP: () => {
          const before = order.slice(0, Math.max(selectedIndex, 0)).map((entry, index) => entry.isBranch ? index : -1).filter(index => index >= 0);
          if (before.length) goTo(before[before.length - 1]);
        },
        ArrowRight: () => branch && setShownVersions(versions => ({ ...versions, [branch.key]: Math.min((versions[branch.key] ?? branch.taken) + 1, branch.versions.length - 1) })),
        ArrowLeft: () => branch && setShownVersions(versions => ({ ...versions, [branch.key]: Math.max((versions[branch.key] ?? branch.taken) - 1, 0) })),
        Enter: () => branch && setOpenBranches(open => { const next = new Set(open); next.has(branch.key) ? next.delete(branch.key) : next.add(branch.key); return next; }),
        Escape: () => {
          if (!branch) return;
          setOpenBranches(open => { const next = new Set(open); next.delete(branch.key); return next; });
          setSelectedKey(branch.key); // back up to the branch it sits in
        }
      };
      const move = moves[event.code];
      if (move) {
        event.preventDefault();
        move();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const setChoice = (rival, choice) => setPath(current => ({ ...current, choices: { ...current.choices, [rival]: choice } }));
  // a version's label is a choice when the branch is what became of a bystander: picking it follows that path from there
  const followVersion = (branch, versionIndex) => {
    const rival = RIVALS.find(({ name }) => branch.label.endsWith(name));
    if (rival && branch.label.startsWith("What became of")) setChoice(rival.id, versionIndex == 0 ? "recruit" : "terminate");
    setShownVersions(versions => ({ ...versions, [branch.key]: versionIndex }));
  };
  const getIsMatch = item => !search || `${item.speakerName} ${item.text}`.toLowerCase().includes(search.toLowerCase());

  const renderBranch = (item, sectionIndex) => {
    const isOpen = openBranches.has(item.key);
    const shown = shownVersions[item.key] ?? item.taken;
    const toggle = () => {
      setSelectedKey(item.key);
      setOpenBranches(open => { const next = new Set(open); next.has(item.key) ? next.delete(item.key) : next.add(item.key); return next; });
    };
    return (
      <Branch key={item.key} ref={refFor(item.key)} $isSelected={selectedKey == item.key}>
        <BranchHead onClick={toggle}>
          ◇ {item.label}
          <Tag $color={LOOK.branch}>{item.versions.length} versions</Tag>
          <span style={{ color: LOOK.dim, fontWeight: 400 }}>{isOpen ? "▾ all versions" : `▸ ${item.versions[shown] ? item.versions[shown].label : ""}`}</span>
        </BranchHead>
        {isOpen ? (
          <Versions $count={item.versions.length}>
            {item.versions.map((version, index) => (
              <Version key={version.label} $isTaken={index == item.taken} $isShown={index == shown}>
                <VersionLabel $isTaken={index == item.taken} onClick={() => followVersion(item, index)}>
                  {version.label}{index == item.taken ? " (this path)" : ""}
                </VersionLabel>
                {version.items.length ? version.items.map(line => (
                  <LineView key={line.key} isCompact item={line} isSelected={selectedKey == `${item.key}/${line.key}`} isMatch={getIsMatch(line)} onSelect={() => setSelectedKey(`${item.key}/${line.key}`)} refFor={() => refFor(`${item.key}/${line.key}`)} />
                )) : <div style={{ color: LOOK.dim, fontSize: 12 }}>(nothing is said)</div>}
              </Version>
            ))}
          </Versions>
        ) : (
          item.versions[shown] && item.versions[shown].items.map(line => (
            <LineView key={line.key} item={line} isSelected={selectedKey == `${item.key}/${line.key}`} isMatch={getIsMatch(line)} onSelect={() => setSelectedKey(`${item.key}/${line.key}`)} refFor={() => refFor(`${item.key}/${line.key}`)} />
          ))
        )}
      </Branch>
    );
  };

  const selectedLine = selected && !selected.isBranch ? selected.item : undefined;

  return (
    <Page>
      <TopBar>
        <strong>Kaiju City dialogue</strong>
        <SaveButton disabled={!isDirty} onClick={save}>{isDirty ? "Save (Ctrl+S)" : "Saved"}</SaveButton>
        {saveNote && <span style={{ color: LOOK.dim, fontSize: 12 }}>{saveNote}</span>}
        <label>Player <select value={path.avatar} onChange={e => setPath({ ...path, avatar: e.target.value })}><option value="guy">Guy</option><option value="girl">Girl</option></select></label>
        <label>A power <select value={path.powerName} onChange={e => setPath({ ...path, powerName: e.target.value })}>{POWER_NAMES.map(name => <option key={name}>{name}</option>)}</select></label>
        {RIVALS.map(({ id, name }) => (
          <label key={id}>{name} <select value={path.choices[id]} onChange={e => setChoice(id, e.target.value)}><option value="recruit">Recruited</option><option value="terminate">Terminated</option></select></label>
        ))}
        <input placeholder="Search speaker or words" value={search} onChange={e => setSearch(e.target.value)} />
        <Crumbs>
          This path:
          <button onClick={() => goToSection(0)}>{path.avatar == "guy" ? "Guy" : "Girl"}</button>·
          <button onClick={() => goToSection(6)}>{path.powerName}</button>
          {RIVALS.map(({ id, name }) => (
            <React.Fragment key={id}>· <button onClick={() => goToSection(STORY.findIndex(({ rival }) => rival == id))}>{path.choices[id] == "recruit" ? "Recruited" : "Terminated"} {name}</button></React.Fragment>
          ))}
        </Crumbs>
      </TopBar>

      <Timeline>
        {sections.map(({ label, index, items, isBranching }) => (
          <TimelineItem key={label} $isCurrent={index == currentSection} $isEmpty={!items.length} onClick={() => goToSection(index)}>
            {isBranching ? "◇ " : ""}{label}
          </TimelineItem>
        ))}
      </Timeline>

      <Script>
        {sections.map(({ label, index, items, scenes: sceneIds }) => (
          <section key={label} ref={element => { sectionRefs.current[index] = element; }}>
            <SectionHeader>{index + 1}. {label}</SectionHeader>
            {!items.length && <SceneLabel>no lines here</SceneLabel>}
            {sceneIds.map(sceneId => {
              const sceneItems = items.filter(item => item.sceneId == sceneId);
              return sceneItems.length ? (
                <React.Fragment key={sceneId}>
                  <SceneLabel>{scenes[sceneId].label}</SceneLabel>
                  {sceneItems.map(item => item.kind == "branch"
                    ? renderBranch(item, index)
                    : <LineView key={item.key} item={item} isSelected={selectedKey == item.key} isMatch={getIsMatch(item)} onSelect={setSelectedKey} refFor={refFor} />)}
                </React.Fragment>
              ) : null;
            })}
          </section>
        ))}
      </Script>

      <Side>
        {selectedLine ? (() => {
          const { line, sceneId } = selectedLine;
          const isStageDirection = !line.speaker;
          return (
            <dl>
              <dt>Scene</dt><dd>{scenes[sceneId].label}</dd>
              {isStageDirection ? <><dt>Stage direction</dt><dd>{selectedLine.text}</dd></> : <>
                <dt>Who says it</dt>
                <dd>
                  <select value={line.speaker} onChange={e => updateLine(sceneId, line.id, { speaker: e.target.value })}>
                    {[...SPEAKERS, ...(SPEAKERS.some(([id]) => id == line.speaker) ? [] : [[line.speaker, line.speaker]])].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </dd>
                <dt>The words <span style={{ fontSize: 11 }}>({"{power}"} is a power; pronoun words fit whoever plays)</span></dt>
                <dd>
                  <textarea value={line.text || ""} onChange={e => updateLine(sceneId, line.id, { text: e.target.value })} />
                  <ButtonRow>{PRONOUN_WORDS.map(word => <button key={word} onClick={() => updateLine(sceneId, line.id, { text: `${line.text || ""}${word}` })}>{word}</button>)}</ButtonRow>
                </dd>
                <dt>On this path it reads</dt><dd>{selectedLine.text}</dd>
                {getHasShots(sceneId) && <>
                  <dt>Camera</dt>
                  <dd>
                    <select value={line.shot || ""} onChange={e => updateLine(sceneId, line.id, { shot: e.target.value || undefined })}>
                      <option value="">The scene's own shot (on the speaker)</option>
                      <option value="wide">The whole scene</option>
                    </select>
                  </dd>
                </>}
                <dt>Shown as</dt><dd>{line.isBalloon ? "a speech balloon" : "a line in the log"}</dd>
                {line.note == "jamie" && <><dt>Written by</dt><dd>Jamie</dd></>}
              </>}
              <ButtonRow>
                <button onClick={() => addLineAfter(sceneId, line.id)}>+ Add a line after</button>
                <button data-danger onClick={() => deleteLine(sceneId, line.id)}>Delete this line</button>
              </ButtonRow>
              <dt>Line id</dt><dd style={{ color: LOOK.dim }}>{line.id}</dd>
            </dl>
          );
        })() : selected && selected.isBranch ? (
          <dl>
            <dt>Branch</dt><dd>{selected.item.label}</dd>
            <dt>Versions</dt><dd>{selected.item.versions.map(({ label }) => label).join(" / ")}</dd>
            <dt>This path takes</dt><dd>{selected.item.versions[selected.item.taken] ? selected.item.versions[selected.item.taken].label : "-"}</dd>
          </dl>
        ) : <div style={{ color: LOOK.dim }}>Select a line to edit it here.</div>}
        <Keys>
          ↑ ↓ a line · Page Up / Down a section<br />
          N / P the next or previous branch<br />
          ← → a branch's versions<br />
          Enter open a branch · Esc close it, back up to it
        </Keys>
      </Side>
    </Page>
  );
};
