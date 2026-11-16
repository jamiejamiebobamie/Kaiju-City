import { describe, expect, it } from 'vitest';
import { TAMAGOTCHI_RULES } from './Tamagotchi';

// the Kaiju tamagotchi's rules (Jamie, 2026-11-15)
const { TAMA, step, act, newPet } = TAMAGOTCHI_RULES;
const run = (pet, ms) => {
  for (let k = 0; k < ms / TAMA.tickMs; k++) pet = step(pet);
  return pet;
};

describe('tamagotchi', () => {
  it('neglected (poop left, no care), it loses happiness, bursts into flames, and hatches anew from an egg 5 s later', () => {
    let pet = newPet();
    pet = run(pet, 31000);
    expect(pet.happiness).toBeLessThan(TAMA.happinessMax);
    for (let k = 0; k < 2000 && pet.mode != 'burn'; k++) pet = step(pet);
    expect(pet.mode).toBe('burn');
    pet = run(pet, TAMA.burnMs + 200);
    expect(pet.mode).toBe('egg');
    pet = run(pet, TAMA.eggMs + 200);
    expect(pet.generation).toBe(2);
    expect(pet.happiness).toBe(TAMA.happinessMax);
  });

  it('cared for (fed or petted, cleaned up), it stays happy', () => {
    let pet = newPet();
    for (let s = 0; s < 120; s++) {
      pet = run(pet, 1000);
      if (s % 5 == 0) pet = act(pet, 'Pet');
      while (pet.poops.length) pet = act(pet, 'Clean up');
    }
    expect(pet.happiness).toBe(TAMA.happinessMax);
    expect(pet.mode).not.toBe('burn');
  });

  it('feeding drops pellets that it walks to and eats; clean up takes one poop a click', () => {
    let pet = act(newPet(), 'Feed');
    expect(pet.pellets.length).toBe(3);
    pet = run(pet, 30000);
    expect(pet.pellets.length).toBe(0);
    pet = { ...pet, poops: [{ id: 1, x: 0.3 }, { id: 2, x: 0.6 }] };
    pet = act(pet, 'Clean up');
    expect(pet.poops.length).toBe(1);
    const hearts = pet.hearts.length;
    pet = act(pet, 'Clean up');
    expect(pet.hearts.length).toBeGreaterThan(hearts); // all clean: hearts
  });
});
