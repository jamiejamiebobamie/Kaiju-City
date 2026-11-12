import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import OPTIONS from "Game/DataClasses/classOptions.json";
import { TILE_STATUSES_AND_ABILITY_DATA } from "Utils/gameState";

/*
  /classes (dev only): pick a class name and its description for every combination of three powers.
  Each combo has three names, and each name three descriptions. Pick a name, then one of its descriptions, then confirm.
  Keys: a number (or arrows and Enter) pick; C confirms; Esc or Backspace goes back: from the descriptions to the names,
  from the names to the last combo confirmed. Every confirm saves classOptions.json and writes the pick into sciFiClasses.ts.
  Names and descriptions are unique: one confirmed on one combo is taken everywhere else.
*/
const LOOK = { bg: "#0d1117", panel: "#161b22", line: "#21262d", text: "#e6edf3", dim: "#8b949e", accent: "#6dffa0", picked: "#d29922" };

const Page = styled.div`
  position: fixed;
  inset: 0;
  display: grid;
  grid-template-columns: 1fr 300px;
  font-family: system-ui, sans-serif;
  color: ${LOOK.text};
  background: ${LOOK.bg};
`;

const Main = styled.main`
  padding: 28px 40px;
  overflow-y: auto;
`;

const Progress = styled.div`
  color: ${LOOK.dim};
  margin-bottom: 18px;
  & b { color: ${LOOK.accent}; }
`;

const Powers = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
`;

const Power = styled.div`
  padding: 6px 12px;
  border-radius: 6px;
  font-weight: 600;
  color: #0d1117;
  background: ${props => props.$color};
`;

const Step = styled.div`
  margin: 18px 0 8px;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${LOOK.dim};
`;

const Option = styled.button`
  display: flex;
  gap: 14px;
  align-items: baseline;
  width: 100%;
  margin-bottom: 8px;
  padding: 12px 16px;
  text-align: left;
  font: inherit;
  font-size: 18px;
  border-radius: 6px;
  cursor: ${props => props.disabled ? "not-allowed" : "pointer"};
  color: ${props => props.disabled ? LOOK.dim : LOOK.text};
  background: ${props => props.$isFocused ? "rgba(109, 255, 160, 0.12)" : LOOK.panel};
  border: 1px solid ${props => props.$isFocused ? LOOK.accent : LOOK.line};
  text-decoration: ${props => props.disabled ? "line-through" : "none"};
  & kbd { font-size: 13px; color: ${LOOK.dim}; }
`;

const Chosen = styled.div`
  font-size: 26px;
  font-weight: 700;
  color: ${LOOK.picked};
`;

const Keys = styled.div`
  margin-top: 24px;
  font-size: 13px;
  color: ${LOOK.dim};
  line-height: 1.8;
`;

const Side = styled.aside`
  overflow-y: auto;
  border-left: 1px solid ${LOOK.line};
  background: ${LOOK.panel};
  font-size: 12px;
`;

const SideRow = styled.button`
  display: block;
  width: 100%;
  padding: 4px 12px;
  text-align: left;
  font: inherit;
  border: none;
  cursor: pointer;
  color: ${props => props.$isConfirmed ? LOOK.dim : props.$isReady ? LOOK.text : "#57606a"};
  background: ${props => props.$isCurrent ? LOOK.line : "none"};
`;

/*
  The second pass (Jamie, playtest 21), once every combo is confirmed: all the classes in one list, each name and
  description free to edit, and a tick for each that passes the second pass ("confirmed confirmed"). Nothing is saved
  until Save, and Save first checks every name and every description is used once only.
*/
const PassTable = styled.div`
  display: grid;
  grid-template-columns: 220px 220px 1fr 90px;
  gap: 6px 12px;
  align-items: center;
  font-size: 14px;
  & input[type="text"] {
    font: inherit;
    padding: 6px 8px;
    color: ${LOOK.text};
    background: ${LOOK.panel};
    border: 1px solid ${props => LOOK.line};
    border-radius: 4px;
  }
  & .bad { border-color: #f85149 !important; }
`;

const PassBar = styled.div`
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  gap: 16px;
  align-items: center;
  padding: 10px 0;
  margin-bottom: 10px;
  background: ${LOOK.bg};
  & button { font: inherit; padding: 6px 14px; border-radius: 6px; cursor: pointer; }
`;

const SecondPass = ({ options, onSaved, save }) => {
  const [draft, setDraft] = useState(() => structuredClone(options));
  const [problems, setProblems] = useState([]);
  const keys = Object.keys(draft.combos).filter(key => draft.combos[key].confirmed);
  const isChanged = JSON.stringify(draft) != JSON.stringify(options);
  const passedCount = keys.filter(key => draft.combos[key].confirmed.secondPass).length;
  const edit = (key, field, value) => setDraft(previous => {
    const next = structuredClone(previous);
    next.combos[key].confirmed[field] = value;
    return next;
  });
  // the names and descriptions used more than once (or left empty)
  const getDuplicates = field => {
    const byValue = new Map();
    keys.forEach(key => {
      const value = draft.combos[key].confirmed[field].trim().toLowerCase();
      byValue.set(value, [...(byValue.get(value) || []), key]);
    });
    return new Set([...byValue.entries()].filter(([value, list]) => !value || list.length > 1).flatMap(([, list]) => list));
  };
  const badNames = getDuplicates("name");
  const badDescriptions = getDuplicates("description");
  const onSave = async () => {
    const found = [
      ...[...badNames].map(key => `name "${draft.combos[key].confirmed.name}" (${key}) is empty or used twice`),
      ...[...badDescriptions].map(key => `description of ${key} is empty or used twice`)
    ];
    setProblems(found);
    if (found.length) return;
    await save(draft);
    onSaved(draft);
  };
  return (
    <>
      <PassBar>
        <b>Second pass</b>
        <span style={{ color: LOOK.dim }}>{passedCount} of {keys.length} confirmed confirmed{isChanged ? " · unsaved changes" : ""}</span>
        <button disabled={!isChanged} onClick={onSave}>Save</button>
        <button disabled={!isChanged} onClick={() => { setDraft(structuredClone(options)); setProblems([]); }}>Undo changes</button>
      </PassBar>
      {problems.length > 0 && <div style={{ color: "#f85149", marginBottom: 10 }}>Not saved: {problems.slice(0, 6).join("; ")}{problems.length > 6 ? ` (and ${problems.length - 6} more)` : ""}</div>}
      <PassTable>
        <b>Powers</b><b>Class name</b><b>Description</b><b>Passes</b>
        {keys.map(key => {
          const { name, description, secondPass } = draft.combos[key].confirmed;
          return (
            <React.Fragment key={key}>
              <span style={{ color: LOOK.dim }}>{key.replace(/,/g, " · ")}</span>
              <input type="text" className={badNames.has(key) ? "bad" : ""} value={name} onChange={event => edit(key, "name", event.target.value)} />
              <input type="text" className={badDescriptions.has(key) ? "bad" : ""} value={description} onChange={event => edit(key, "description", event.target.value)} />
              <label><input type="checkbox" checked={!!secondPass} onChange={() => edit(key, "secondPass", !secondPass)} /> ✓✓</label>
            </React.Fragment>
          );
        })}
      </PassTable>
    </>
  );
};

// a combo's powers are named like 'Bubble' or 'Glass': each power's look, by that name
const POWER_LOOKS = Object.fromEntries(TILE_STATUSES_AND_ABILITY_DATA.filter(({ element }) => element).map(look => [look.element[0].toUpperCase() + look.element.slice(1), look]));

// a combo is ready to review once all three names and their three descriptions are written
const getIsReady = combo => combo.names.length >= 3 && combo.names.every(({ descriptions }) => descriptions.length >= 3);

export const ClassReview = () => {
  const [options, setOptions] = useState(() => structuredClone(OPTIONS));
  const keys = useMemo(() => Object.keys(options.combos), [options]);
  const getNext = (after = -1) => keys.find((key, index) => index > after && !options.combos[key].confirmed && getIsReady(options.combos[key]))
    || keys.find(key => !options.combos[key].confirmed && getIsReady(options.combos[key]));
  const [current, setCurrent] = useState(() => getNext());
  const [nameIndex, setNameIndex] = useState(undefined); // the name picked, once there is one
  const [focus, setFocus] = useState(0);
  const [descriptionIndex, setDescriptionIndex] = useState(undefined);
  const [note, setNote] = useState("");
  // every combo confirmed: the second pass opens (the first pass stays a click away)
  const [isSecondPass, setIsSecondPass] = useState(() => Object.values(OPTIONS.combos).every(each => each.confirmed));

  const combo = current && options.combos[current];
  const confirmedCount = keys.filter(key => options.combos[key].confirmed).length;
  const readyCount = keys.filter(key => !options.combos[key].confirmed && getIsReady(options.combos[key])).length;
  const waitingCount = keys.length - confirmedCount - readyCount;

  // a name or description confirmed on another combo is taken
  const taken = useMemo(() => {
    const names = new Set();
    const descriptions = new Set();
    keys.forEach(key => {
      const { confirmed } = options.combos[key];
      if (confirmed && key != current) {
        names.add(confirmed.name);
        descriptions.add(confirmed.description);
      }
    });
    return { names, descriptions };
  }, [options, current]);

  const open = key => {
    setCurrent(key);
    const { confirmed, names } = options.combos[key] || {};
    const confirmedName = confirmed ? names.findIndex(({ name }) => name == confirmed.name) : -1;
    setNameIndex(undefined);
    setDescriptionIndex(confirmedName >= 0 ? names[confirmedName].descriptions.indexOf(confirmed.description) : undefined);
    setFocus(Math.max(confirmedName, 0));
  };

  const save = async next => {
    setNote("Saving...");
    try {
      const response = await fetch("/__classes/save", { method: "POST", body: JSON.stringify(next) });
      if (!response.ok) throw new Error(await response.text());
      setNote("Saved.");
    } catch (error) {
      setNote(`Not saved: ${error.message}`);
    }
  };

  const pickName = index => {
    if (!combo || !combo.names[index] || taken.names.has(combo.names[index].name)) return;
    setNameIndex(index);
    setDescriptionIndex(undefined);
    setFocus(0);
  };

  const pickDescription = index => {
    const name = combo.names[nameIndex];
    if (!name || !name.descriptions[index] || taken.descriptions.has(name.descriptions[index])) return;
    setDescriptionIndex(index);
    setFocus(index);
  };

  const confirm = () => {
    if (nameIndex === undefined || descriptionIndex === undefined) return;
    const name = combo.names[nameIndex];
    const next = structuredClone(options);
    next.combos[current].confirmed = { name: name.name, description: name.descriptions[descriptionIndex], at: Date.now() };
    setOptions(next);
    save(next);
    const nextKey = keys.find((key, index) => index > keys.indexOf(current) && !next.combos[key].confirmed && getIsReady(next.combos[key]))
      || keys.find(key => !next.combos[key].confirmed && getIsReady(next.combos[key]));
    setCurrent(nextKey);
    setNameIndex(undefined);
    setDescriptionIndex(undefined);
    setFocus(0);
  };

  // back: from the descriptions to the names; from the names to the last combo confirmed
  const back = () => {
    if (nameIndex !== undefined) {
      setFocus(nameIndex);
      setNameIndex(undefined);
      setDescriptionIndex(undefined);
      return;
    }
    const last = keys.filter(key => options.combos[key].confirmed && key != current).sort((a, b) => options.combos[b].confirmed.at - options.combos[a].confirmed.at)[0];
    if (last) open(last);
  };

  useEffect(() => {
    const onKey = event => {
      if (!combo || isSecondPass) return;
      const list = nameIndex === undefined ? combo.names : combo.names[nameIndex].descriptions;
      const pick = nameIndex === undefined ? pickName : pickDescription;
      const moves = {
        // a number key picks that option (some combos have more than three names)
        ...Object.fromEntries(list.flatMap((_, index) => index < 9 ? [[`Digit${index + 1}`, () => pick(index)], [`Numpad${index + 1}`, () => pick(index)]] : [])),
        ArrowDown: () => setFocus(index => Math.min(index + 1, list.length - 1)),
        ArrowUp: () => setFocus(index => Math.max(index - 1, 0)),
        Enter: () => pick(focus),
        KeyC: confirm,
        Escape: back,
        Backspace: back
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

  const powers = current ? current.split(",") : [];

  return (
    <Page>
      <Main>
        <button style={{ float: "right" }} onClick={() => setIsSecondPass(!isSecondPass)}>{isSecondPass ? "First pass" : "Second pass"}</button>
        {isSecondPass ? <SecondPass options={options} save={save} onSaved={setOptions} /> : <>
        <Progress><b>{confirmedCount}</b> of {keys.length} confirmed · {readyCount} ready to review{waitingCount ? ` · ${waitingCount} waiting for options (ask Claude to write the next batch)` : ""} {note && `· ${note}`}</Progress>
        {!combo ? <div>{readyCount || waitingCount ? "Nothing ready to review: the next options aren't written yet." : "Every combo is confirmed."}</div> : (
          <>
            <Powers>
              {powers.map(power => {
                const look = POWER_LOOKS[power] || {};
                return <Power key={power} $color={look.color || "#ccc"}>{look.activeName || power} <span style={{ fontWeight: 400 }}>({power})</span></Power>;
              })}
            </Powers>
            {combo.confirmed && <div style={{ color: LOOK.dim, fontSize: 13 }}>Confirmed as {combo.confirmed.name}: "{combo.confirmed.description}". Pick again to change it.</div>}
            {nameIndex === undefined ? (
              <>
                <Step>Pick a class name</Step>
                {combo.names.map(({ name }, index) => (
                  <Option key={name} $isFocused={focus == index} disabled={taken.names.has(name)} onClick={() => pickName(index)}>
                    <kbd>{index + 1}</kbd>{name}{index == 0 && name == combo.original.name ? <span style={{ fontSize: 12, color: LOOK.dim }}>(the draft)</span> : null}{taken.names.has(name) ? <span style={{ fontSize: 12 }}>taken</span> : null}
                  </Option>
                ))}
              </>
            ) : (
              <>
                <Chosen>{combo.names[nameIndex].name}</Chosen>
                <Step>Pick its description{descriptionIndex !== undefined ? ", then C to confirm" : ""}</Step>
                {combo.names[nameIndex].descriptions.map((description, index) => (
                  <Option key={description} $isFocused={focus == index || descriptionIndex == index} disabled={taken.descriptions.has(description)} onClick={() => pickDescription(index)}>
                    <kbd>{index + 1}</kbd>{description}{descriptionIndex == index ? <span style={{ color: LOOK.picked, fontSize: 13 }}>picked</span> : null}
                  </Option>
                ))}
                {descriptionIndex !== undefined && <Option $isFocused onClick={confirm}><kbd>C</kbd>Confirm {combo.names[nameIndex].name}</Option>}
              </>
            )}
          </>
        )}
        <Keys>
          A number or ↑ ↓ and Enter pick · C confirms and moves on<br />
          Esc or Backspace goes back: to the names, then to the last combo you confirmed
        </Keys>
        </>}
      </Main>
      <Side>
        {keys.map(key => {
          const each = options.combos[key];
          return (
            <SideRow key={key} $isCurrent={key == current} $isConfirmed={!!each.confirmed} $isReady={getIsReady(each)} onClick={() => getIsReady(each) && open(key)}>
              {each.confirmed ? "✓ " : getIsReady(each) ? "• " : "  "}{key.replace(/,/g, " · ")}{each.confirmed ? `: ${each.confirmed.name}` : ""}
            </SideRow>
          );
        })}
      </Side>
    </Page>
  );
};
