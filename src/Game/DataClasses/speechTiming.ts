// a speech bubble types itself out, letter by letter, and then stays up long enough to read
// the longer the line, the longer it stays: a short shout goes by quickly
export const SPEECH_TIMING = {
  typeMsPerLetter: 22,
  readMsPerLetter: 36,
  holdMs: 1200
};

export const getSpeechMs = (text: string) => {
  const { typeMsPerLetter, readMsPerLetter, holdMs } = SPEECH_TIMING;
  return holdMs + text.length * (typeMsPerLetter + readMsPerLetter);
};
