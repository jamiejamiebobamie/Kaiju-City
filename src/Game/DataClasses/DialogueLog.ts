/*
  The dialogue log: conversations go to a panel beside the monitor, line by line, each kept above the next,
  instead of speech balloons in the scene. Quick shouts in the action stay as balloons.
  It is on with the monitor ("Monitor always"). A dev playtest, "Click through" (on by default), makes each line wait
  for a key or a click before the next.
*/
export const DIALOGUE = {
  establishMs: 1800, // a conversation in a wide shot first holds on the whole scene this long
  speakerZoomScale: 1.3, // then the camera goes to each speaker, this much closer than play
  choiceZoomScale: 1.7, // the Recruit or Terminate choice, close on the team over the bystander
  introZoomScale: 1.9, // a recruit battle's opening words, close on the speaker
  letterMs: 22 // the newest line types out this fast
};

const CLICK_THROUGH_KEY = 'kaiju-click-through';

let isLog = false;
let isClickThrough = (() => {
  try {
    return localStorage.getItem(CLICK_THROUGH_KEY) != 'false';
  } catch {
    return true;
  }
})();

export const getIsDialogueLog = () => isLog;
export const setIsDialogueLog = (value: boolean) => { isLog = value; };

export const getIsClickThrough = () => isClickThrough;
export const setIsClickThrough = (value: boolean) => {
  isClickThrough = value;
  try {
    localStorage.setItem(CLICK_THROUGH_KEY, String(value));
  } catch {
    // it just won't be remembered
  }
};
