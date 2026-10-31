import React, { useState, useEffect, useRef } from "react";

export { getRandomIntInRange } from "Game/utils";

export const useHover = () => {
  const [value, setValue] = useState(null);
  const handleMouseOver = key => setValue(key);
  const handleMouseOut = () => setValue(null);
  const ref = useRef({}).current;
  const saveRef = key => r => {
    ref[key] = r;
    r && r.addEventListener("mouseover", () => handleMouseOver(key));
    r && r.addEventListener("mouseout", handleMouseOut);
  };
  useEffect(() => {
    if (ref && ref.current) {
      return () =>
        Object.values(ref.current).forEach(i => {
          ref.current[i].removeEventListener("mouseover", handleMouseOver);
          ref.current[i].removeEventListener("mouseout", handleMouseOut);
        });
    }
  }, [ref.current]);
  return [saveRef, value];
};
export const useKeyPress = ({ keyCodes, keyDownCallback = undefined, keyUpCallback = undefined, isCharacterDead }) => {
  // the listeners stay put. they read the latest props from here.
  const latest = useRef({});
  latest.current = { keyCodes, keyDownCallback, keyUpCallback, isCharacterDead };
  useEffect(() => {
    const getIsKeyCode = code => {
      const { keyCodes } = latest.current;
      return Array.isArray(keyCodes) ? keyCodes.includes(code) : keyCodes === code;
    };
    const handleKeyDown = ({ code, repeat }) => {
      const { keyDownCallback, isCharacterDead } = latest.current;
      // Exit immediately if the key is just being held down
      if (repeat || isCharacterDead) return;
      if (keyDownCallback && getIsKeyCode(code)) keyDownCallback(code);
    };
    const handleKeyUp = ({ code }) => {
      const { keyUpCallback } = latest.current;
      if (keyUpCallback && getIsKeyCode(code)) keyUpCallback(code);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);
};

export const getAbilityPickerDescription = (string, playerData, playerIndex) => {
  switch (string) {
    case "modifiers":
      return playerData && playerData[playerIndex]
        ? {
          title: playerIndex === 1 ? "Your teammate" : "You",
          description: [
            <div>
              Move Speed:{" "}
              <span
                style={{
                  color:
                    playerData[playerIndex].moveSpeed > 6
                      ? "green"
                      : playerData[playerIndex].moveSpeed < 6
                        ? "red"
                        : "black"
                }}
              >
                {playerData[playerIndex].moveSpeed}
              </span>
            </div>,
            <br />,
            <div>
              Lives:{" "}
              <span
                style={{
                  color:
                    playerData[playerIndex].lives > 4
                      ? "green"
                      : playerData[playerIndex].lives < 4
                        ? "red"
                        : "black"
                }}
              >
                {playerData[playerIndex].lives}
              </span>
            </div>,
            <br />,
            <div>
              Num Tiles Modifier:{" "}
              <span
                style={{
                  color:
                    playerData[playerIndex].numTilesModifier > 0
                      ? "green"
                      : "black"
                }}
              >
                {playerData[playerIndex].numTilesModifier}
              </span>
            </div>,
            <br />,
            <div>
              Tiles Count Modifier:{" "}
              <span
                style={{
                  color:
                    playerData[playerIndex].tileCountModifier > 0
                      ? "green"
                      : "black"
                }}
              >
                {playerData[playerIndex].tileCountModifier}
              </span>
            </div>
          ],
          effect1: "",
          effect2: "",
          img: "",
          formatData: {}
        }
        : {
          title: "",
          description: "",
          effect1: "",
          effect2: "",
          img: "",
          formatData: {}
        };
    case "class":
      return {
        title:
          playerData &&
          playerData[playerIndex] &&
          playerData[playerIndex].playerClass &&
          `Class: ${playerData[playerIndex].playerClass}`,
        description:
          playerData &&
          playerData[playerIndex] &&
          playerData[playerIndex].playerClassDescription &&
          playerData[playerIndex].playerClassDescription,
        effect1:
          playerData &&
          playerData[playerIndex] &&
          playerData[playerIndex].elements &&
          playerData[playerIndex].elements,
        effect2: "",
        img: "",
        formatData: {}
      };
    case "abilityLoveActive":
      return {
        title: "Heal",
        description: "Heal your teammate",
        effect1: "",
        effect2: "RoE: 7 AoE: 1",
        RoE: "7",
        AoE: "1",
        img: "",
        formatData: {},
        icon: "fa-heart",
        color: "pink"
      };
    case "abilityLovePassive":
      return {
        title: "Good Vibes",
        description: "You send out good vibes",
        effect1: "+1 effect range",
        effect2: "",
        img: "",
        formatData: {},
        icon: "fa-gratipay",
        color: "pink"
      };
    case "abilityMetalPassive":
      return {
        title: "Seasoned Builder",
        description: "You are prolific",
        effect1: "+1 effect range",
        effect2: "",
        // effect2: "+1 tile count modifier",
        img: "",
        formatData: {},
        icon: "fa-wrench",
        color: "AntiqueWhite"
      };
    case "abilityMetalActive":
      return {
        title: "Aegis",
        description:
          "Create an area of protection around you. Blocking many ranged attacks",
        effect1: "Status remains on the tile until walked on",
        effect2: "RoE: 2 AoE: 6",
        RoE: "2",
        AoE: "6",
        img: "",
        formatData: {},
        icon: "fa-shield",
        color: "AntiqueWhite"
      };
    case "abilityGlassPassive":
      return {
        title: "Warp Energy Overload",
        description: "For a short time after teleporting, your magic is multiplied",
        effect1: "+2 effect area",
        effect2: "",
        img: "",
        formatData: {},
        icon: "fa-tencent-weibo",
        color: "BlueViolet"
      };
    case "abilityGlassActive":
      return {
        title: "Escape",
        description: "Instantly travel to a safe tile",
        effect1: "",
        effect2: "",
        img: "",
        formatData: {},
        icon: "fa-ravelry",
        color: "BlueViolet"
      };
    case "abilityIcePassive":
      return {
        title: "Inclement Weather",
        description: "The forecast calls for snow",
        effect1: "-1 move speed",
        effect2: "",
        img: "",
        formatData: {},
        icon: "fa-thermometer-quarter",
        color: "PaleTurquoise"
      };
    case "abilityIceActive":
      return {
        title: "Ice Slice",
        description: "Conjure a stationary vortex of ice",
        effect1: "",
        effect2: "RoE: 10 AoE: 6",
        RoE: "10",
        AoE: "6",
        img: "",
        formatData: {},
        icon: "fa-snowflake-o",
        color: "PaleTurquoise"
      };
    case "abilityWaterPassive":
      return {
        title: "Slippery",
        description: "...when wet. Exercise caution.",
        effect1: "-1 movement speed",
        effect2: "",
        img: "",
        formatData: {},
        icon: "fa-exclamation-triangle",
        color: "#3c7fde"
      };
    case "abilityWaterActive":
      return {
        title: "Tidal Wave",
        description: "Create a single, lateral line of water",
        effect1: "Water travels in the direction of your closest enemy",
        effect2: "RoE: 10 AoE: 3",
        RoE: "10",
        AoE: "3",
        img: "",
        formatData: {},
        icon: "fa-tint",
        color: "#3c7fde"
      };
    case "abilityFirePassive":
      return {
        title: "Uncontrolled Burn",
        description: "You've cleared a path...",
        effect1: "+1 effect range",
        effect2: "",
        img: "",
        formatData: {},
        icon: "fa-fire",
        color: "tomato"
      };
    case "abilityFireActive":
      return {
        title: "Wildfire",
        description: "Create a single, lateral line of fire",
        effect1: "Fire travels in the direction of your closest enemy",
        effect2: "RoE: 10 AoE: 3",
        RoE: "10",
        AoE: "3",
        img: "",
        formatData: {},
        icon: "fa-free-code-camp",
        color: "tomato"
      };
    case "abilityWoodPassive":
      return {
        title: "Healthy",
        description: "You're extra healthy",
        effect1: "+1 health",
        effect2: "",
        img: "",
        formatData: {},
        icon: "fa-tree",
        color: "Chartreuse"
      };
    case "abilityWoodActive":
      return {
        title: "Overgrowth",
        description:
          "Poison ivy travels to your closest enemy",
        effect1: "Status remains on the tile until walked on",
        effect2: "RoE: 10 AoE: 3",
        RoE: "10",
        AoE: "3",
        img: "",
        formatData: {},
        icon: "fa-leaf",
        color: "Chartreuse"
      };
    case "abilityLightningPassive":
      return {
        title: "Charged Step",
        description: "Electrical energy courses through your body",
        effect1: "+2 move speed",
        effect2: "",
        img: "",
        formatData: {},
        icon: "fa-hourglass-half",
        color: "cyan"
      };
    case "abilityLightningActive":
      return {
        title: "Discharge",
        description:
          "Cast 3 bolts of lightning in the direction of your closest enemy",
        effect1: "Bolts ricochet off the walls of the map",
        effect2: "RoE: 20 AoE: 3",
        RoE: "20",
        AoE: "3",
        img: "",
        formatData: {},
        icon: "fa-bolt",
        color: "cyan"
      };
    case "abilityDeathPassive":
      return {
        title: "Blood Ritual",
        description: "You cut a fresh wound",
        effect1: "-1 health",
        effect2: "",
        img: "",
        formatData: {},
        icon: "fa-heartbeat",
        color: "GhostWhite"
      };
    case "abilityDeathActive":
      return {
        title: "Haunt",
        description: "Shoot a ghost at your closest enemy",
        effect1: "",
        effect2: "RoE: 30 AoE: 1",
        RoE: "30",
        AoE: "1",
        img: "",
        formatData: {},
        icon: "fa-snapchat-ghost",
        color: "GhostWhite"
      };
    case "abilityBubblePassive":
      return {
        title: "Insight",
        description: "The bubbles teach you so many things",
        effect1: "+1 effect range",
        effect2: "",
        img: "",
        formatData: {},
        icon: "fa-universal-access",
        color: "Thistle"
      };
    case "abilityBubbleActive":
      return {
        title: "Dispel",
        description: "Dispel all tile effects around you",
        effect1: "Clears both positive and negative statuses",
        effect2: "RoE: 7 AoE: 6",
        RoE: "7",
        AoE: "6",
        img: "",
        formatData: {},
        icon: "fa-question-circle-o",
        color: "Thistle"
      };
    case "healthBar":
      return {
        title: "Health Bar",
        description: "Your health bar",
        effect1: "",
        effect2: "",
        img: "",
        formatData: {},
        icon: ""
      };
    case "Kaiju":
      return {
        title: "Kaiju",
        description: "They come from the sea!",
        effect1: "",
        effect2: "",
        img: "",
        formatData: {},
        icon: ""
      };
  }
};
