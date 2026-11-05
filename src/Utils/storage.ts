/*
  Where the game remembers things: unlocks, recruit choices, avatar colors, and the dev panel's switches.
  For now nothing is saved in the browser (Jamie, 2026-11-05): it is all kept for this visit only, so every
  playthrough starts clean. Turning saves back on is a backlog item for when development is done: set IS_SAVING.
*/
const IS_SAVING = false;

const visit = new Map<string, string>();

export const storage = {
  getItem(key: string): string | null {
    if (IS_SAVING) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return visit.has(key) ? visit.get(key) : null;
  },
  setItem(key: string, value: string) {
    if (IS_SAVING) {
      try {
        localStorage.setItem(key, value);
      } catch { /* (not remembered) */ }
      return;
    }
    visit.set(key, value);
  },
  // tests start each case clean
  clear() {
    visit.clear();
  }
};
