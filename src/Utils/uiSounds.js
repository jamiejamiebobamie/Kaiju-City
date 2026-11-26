/*
  The buttons' sounds (Jamie, 2026-11-26), for every button on the page at once: a tick as the pointer comes onto one,
  a click as it's pressed. A button may name its own ('data-sfx' for the press, 'data-sfx-hover' for the tick, "none"
  for silence): the console's Play! and Back, the side monitor's round buttons. A disabled button is silent.
*/
import { playSfx } from "./sfx";

const BUTTONS = "button, [role=button], [data-sfx], [data-sfx-hover]";
let isInstalled = false;

export const installUiSounds = () => {
  if (isInstalled || typeof document == "undefined") return;
  isInstalled = true;
  let hovered;
  document.addEventListener("pointerover", event => {
    const button = event.target instanceof Element ? event.target.closest(BUTTONS) : null;
    if (button == hovered) return;
    hovered = button;
    if (!button || button.disabled || button.getAttribute("aria-disabled") == "true") return;
    const id = button.getAttribute("data-sfx-hover") || "ui-hover";
    if (id != "none") playSfx(id, { gain: 0.6, minGapMs: 60 });
  }, { passive: true });
  document.addEventListener("click", event => {
    const button = event.target instanceof Element ? event.target.closest(BUTTONS) : null;
    if (!button || button.disabled) return;
    const id = button.getAttribute("data-sfx") || "ui-click";
    if (id != "none") playSfx(id);
  }, { capture: true, passive: true });
};
