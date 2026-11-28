import { useEffect, useState } from "react";

/*
  Which device the game is laid out for (Jamie, 2026-11-28; layout phase 4, mobile): "phone", "tablet" or "desktop".
  Touch-first AND small: a touchscreen laptop (it has a mouse or trackpad too) stays desktop.
  Dev: forced from the dev panel (saved in this browser) or ?device=phone for one visit, to try it on the PC.
*/
export const DEVICE_KINDS = ["phone", "tablet", "desktop"];
const OVERRIDE_KEY = "kaiju-device";
const PHONE_SHORT_SIDE_PX = 600; // a touch screen whose short side is under this is a phone; else a tablet

/*
  The touch tuning switches (the HUD layout, the device) in a built game too, for playtests on a phone (Jamie, mobile
  playtest 1: the dev server is much slower there): open it once with ?tune, and this browser keeps them; ?tune=off to
  stop.
*/
const TUNE_KEY = "kaiju-tune";
export const getIsTuning = () => {
  if (import.meta.env.DEV) return true;
  if (typeof window == "undefined") return false;
  const fromAddress = new URLSearchParams(window.location.search).get("tune");
  if (fromAddress !== null) {
    if (fromAddress == "off") window.localStorage.removeItem(TUNE_KEY);
    else window.localStorage.setItem(TUNE_KEY, "1");
  }
  return window.localStorage.getItem(TUNE_KEY) == "1";
};

const getOverride = () => {
  if (typeof window == "undefined") return undefined;
  const fromAddress = new URLSearchParams(window.location.search).get("device");
  if (DEVICE_KINDS.includes(fromAddress)) return fromAddress;
  if (!getIsTuning()) return undefined;
  const saved = window.localStorage.getItem(OVERRIDE_KEY);
  return DEVICE_KINDS.includes(saved) ? saved : undefined;
};

const detect = () => {
  if (typeof window == "undefined" || !window.matchMedia) return "desktop";
  const isTouchFirst = window.matchMedia("(pointer: coarse)").matches && !window.matchMedia("(any-pointer: fine)").matches;
  if (!isTouchFirst) return "desktop";
  const shortSide = Math.min(window.screen.width, window.screen.height);
  return shortSide < PHONE_SHORT_SIDE_PX ? "phone" : "tablet";
};

export const getDeviceKind = () => getOverride() || detect();
// the touch layout: no monitor, no room, the game filling the screen, touch controls on it
export const getIsTouchLayout = () => getDeviceKind() != "desktop";
export const getIsDeviceForced = () => !!getOverride();

const listeners = new Set();
// dev: force a device ("auto": as detected). The page re-lays itself out at once.
export const setDeviceOverride = kind => {
  if (DEVICE_KINDS.includes(kind)) window.localStorage.setItem(OVERRIDE_KEY, kind);
  else window.localStorage.removeItem(OVERRIDE_KEY);
  listeners.forEach(listener => listener());
};

const read = () => {
  const kind = getDeviceKind();
  const isPortrait = typeof window != "undefined" && window.innerHeight > window.innerWidth;
  return { kind, isTouch: kind != "desktop", isPortrait };
};

// the device, kept up to date as the screen turns or the window resizes
export const useDevice = () => {
  const [device, setDevice] = useState(read);
  useEffect(() => {
    const update = () => setDevice(previous => {
      const next = read();
      return next.kind == previous.kind && next.isPortrait == previous.isPortrait ? previous : next;
    });
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    listeners.add(update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      listeners.delete(update);
    };
  }, []);
  return device;
};

/*
  The touch intro (Jamie, 2026-11-28): on a phone or tablet, the landing's zoom ends in the apartment on the computer's
  live screen, as on a desktop; PLAY is pressed by itself, a little of the avatar select opens, then a cut to the touch
  layout, tying the room's computer to the phone in the player's hand. Set by the landing as its zoom hands over.
  'playAfterMs': the start screen's wait before PLAY presses itself; 'avatarMs': the avatar select's opening seen before
  the cut (its lights come on at 2.5 s).
*/
export const TOUCH_INTRO = { isPending: false, playAfterMs: 1100, avatarMs: 6200, cutMs: 450 };
