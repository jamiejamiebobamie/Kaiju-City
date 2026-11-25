import DIALOGUE from './dialogue-polished.json';

/*
  The dialogue file the game reads (Jamie, playtest 38): the polished copy. dialogue.json is the original, kept as it
  was. In the polished file, a line Claude changed keeps its old words in 'original' ('' for a line Claude added) until
  Jamie approves it or reverts it in the dialogue viewer; the bios the same ('originalBio').
*/
export const DIALOGUE_FILE_NAME = 'dialogue-polished.json';
export default DIALOGUE;
