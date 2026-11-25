import LAYOUT from '../ReactComponents/ApartmentMockup/mockup.json';

/*
  The apartment (Jamie, 2026-11-25; layout phase 3: the game's own now, no longer a ?apartment trial): what was settled
  in the mock-up tool (/apartment, its saved mockup.json) is the game's layout:
  - the room: Jamie's relit picture put together (scripts/apartmentComposite.py), its monitor where the layout has it
  - the screen's shape (monitor.aspect) and the whole view's zoom (screenZoom)
  - each camera's place across the screen (cameras: 'alone', 'side'), in px of a 1920-wide screen
  Each still works alone too (?screen=, ?zoom=).
*/
// (it was dev only, with ?apartment in the address)
const getIsOn = () => true;

const layout: any = LAYOUT;
export const APARTMENT_TRIAL = getIsOn() ? {
  monitor: layout.monitor as { centerX: number; bottom: number; height: number; aspect?: number },
  screenZoom: (layout.screenZoom || 1) as number,
  cameras: { alone: { dx: 0, dy: 0 }, side: { dx: 0, dy: 0 }, ...(layout.cameras || {}) } as Record<'alone' | 'side', { dx: number; dy: number }>,
  // the clock's 12:00 and the coffee's steam, over the clock and the mug where the layout put them
  clock: (layout.layers || []).find(each => each.part == 'clock'),
  mug: (layout.layers || []).find(each => each.part == 'mug')
} : undefined;
