// a speech bubble types itself out, letter by letter, and then stays up long enough to read
export const SPEECH_TIMING = {
  typeMsPerLetter: 32,
  readMsPerLetter: 48,
  holdMs: 2000
};

export const getSpeechMs = (text: string) => {
  const { typeMsPerLetter, readMsPerLetter, holdMs } = SPEECH_TIMING;
  return holdMs + text.length * (typeMsPerLetter + readMsPerLetter);
};
