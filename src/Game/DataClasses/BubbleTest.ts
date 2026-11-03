/*
  A playtest: Bubble's Dispel is too strong, so its passive is a drawback. These are the options, to try alone or together.
  Each is switched on in the dev panel and remembered in the browser. The numbers are here to tune.
*/
export const BUBBLE_DRAWBACKS = {
  suds: { label: 'Suds', ms: 2000, speed: -1, describe: () => 'Cleared tiles stay soapy for 2 seconds and slow anyone on them' },
  burst: { label: 'Burst', lockMs: 1500, describe: () => 'Your other powers wait 1.5 seconds after a Dispel' },
  cleanSlate: { label: 'Clean Slate', describe: () => "A Dispel ends your other powers' passives" },
  soaked: { label: 'Soaked', ms: 3000, speed: -1, describe: () => '-1 speed for 3 seconds after a Dispel' },
  fizzOut: { label: 'Fizz Out', windowMs: 4000, areaPerCast: 1, minArea: 1, describe: () => 'Each Dispel within 4 seconds of the last is a tile smaller' }
};

export type BubbleDrawback = keyof typeof BUBBLE_DRAWBACKS;

const KEY = 'kaiju-bubble-test';
let enabled = new Set<BubbleDrawback>(['fizzOut']);
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (Array.isArray(saved)) enabled = new Set(saved.filter(id => id in BUBBLE_DRAWBACKS));
} catch { /* (not remembered) */ }

export const getIsDrawbackOn = (id: BubbleDrawback) => enabled.has(id);

export const setIsDrawbackOn = (id: BubbleDrawback, isOn: boolean) => {
  if (isOn) enabled.add(id);
  else enabled.delete(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...enabled]));
  } catch { /* (not remembered) */ }
};

// for the ability picker: what Bubble's passive does right now
export const getDispelDrawbackText = () => {
  const on = (Object.keys(BUBBLE_DRAWBACKS) as Array<BubbleDrawback>).filter(getIsDrawbackOn);
  return on.length ? on.map(id => BUBBLE_DRAWBACKS[id].describe()).join('. ') : 'No effect for now';
};

// Fizz Out: how much smaller this Dispel is, from how quickly it followed the last one
export const getFizzOutArea = (ability, lastCastAt: number | undefined, accTime: number) => {
  const { windowMs, areaPerCast } = BUBBLE_DRAWBACKS.fizzOut;
  const isQuick = getIsDrawbackOn('fizzOut') && lastCastAt !== undefined && accTime - lastCastAt <= windowMs;
  ability.fizzStacks = isQuick ? (ability.fizzStacks || 0) + 1 : 0;
  return -ability.fizzStacks * areaPerCast;
};

// the drawbacks that land on the caster as they Dispel
export const applyDispelDrawbacks = ({ ability, piece, accTime, registerTimeout }) => {
  const otherAbilities = piece.abilities.filter(other => other !== ability);
  if (getIsDrawbackOn('burst')) {
    otherAbilities.forEach(other => { other.lockedUntil = Math.max(other.lockedUntil, accTime + BUBBLE_DRAWBACKS.burst.lockMs); });
  }
  if (getIsDrawbackOn('cleanSlate')) otherAbilities.forEach(other => other.endAllPassives(piece));
  if (getIsDrawbackOn('soaked')) {
    const { ms, speed } = BUBBLE_DRAWBACKS.soaked;
    // casting again restarts the time instead of stacking: only the latest cast's timer takes it off
    if (!piece.soakedUntil) piece.moveSpeedModifier += speed;
    const endsAt = accTime + ms;
    piece.soakedUntil = endsAt;
    registerTimeout(() => {
      if (piece.soakedUntil != endsAt) return;
      piece.moveSpeedModifier -= speed;
      piece.soakedUntil = 0;
    }, ms);
  }
};
