import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { getRandomIntInRange } from "../Utils/utils";
import { BannerImg } from "Components/StyledComponents";

/* transform: scale(1, 1.25); */

const Wrapper = styled.svg`
  position: absolute;
  z-index: ${props => props.zIndex};
  width: 75%;
  height: 350px;
  pointer-events: none;
  top: ${props => (props.isNavBar ? "25px" : "-50px")};
  /* background-color: red; */
  /* align-self: flex-start; */
`;
const StyledCircle = styled.circle`
  ${props => `animation: blinker ${props.randDur}s linear infinite;`}
  @keyframes blinker {
    0% {
      opacity: 0.5;
    }
    50% {
      opacity: 0.7;
    }
    100% {
      opacity: 0.5;
    }
  }
`;
export const SkyLineSVG = ({ zIndex, isNavBar }) => {
  const [skylineCoords, setSkylineCoords] = useState("");
  const [cityLights, setCityLights] = useState("");
  const buildingArray = [
    {
      str: "v -7 h 5 v -7 h 2 v 3 h 5 v 11",
      lowestV: -7,
      width: 12,
      lights: [{ x: 5, y: 15 }]
    },
    {
      str: "v -8 h 4 v -4 h 7 v 4 h 3 v 8",
      lowestV: -8,
      width: 14
    },
    { str: "v 0 h 15", lowestV: 0, width: 15, heightChange: 0 }, //
    {
      str: "v -20 h 2 v -5 h 7 v -5 h 5 v -3 h 5 v 33",
      lowestV: -20,
      width: 19
    },
    {
      str:
        "v -47 h 7 v -3 h 5 v 3 h 7 v 47 h 4 v -47 h 7 v -3 h 5 v 3 h 7 v 47",
      lowestV: -47,
      width: 42,
      lights: [
        { x: 8, y: 50 },
        { x: 34, y: 50 }
      ]
    },
    {
      str:
        "v -8 h 3 v -1 h 15 v -15 h 5 v -3 h 10 v -12 h -5 v -1 h 1 v -1 h 3 l 3,-13 h 3 v -3 l 3,-20 h 5 v 1 h -1 v 2 l 10,32 h 3 v 1 h -3 v 40",
      lowestV: 0,
      width: 55
    },
    { str: "v 0 h 10", lowestV: 0, width: 10, heightChange: 0 }, //
    {
      str: "v -63 h 15 v -4 h 5 v 4 h 25 v 63",
      lowestV: -63,
      width: 45,
      lights: [{ x: 15, y: 67 }]
    },
    {
      str:
        "v -13 h 6 v -9 h 2 v -25 h 4 v -65 h 2 v -4 h 8 v -13 h 1 v -5 h 1 v 5 h 2 v 13 h 18 v 65 h 9 v 51",
      lowestV: -65,
      width: 53,
      lights: [{ x: 23, y: 134 }]
    },
    {
      str: "v -79 h 10 v -37 h 5 v -8 h 30 v 6 h 7 v 6 h 4 v 40 h 5 v 72",
      lowestV: -79,
      width: 61
    },
    { str: "v 0 h 4", lowestV: 0, width: 4 }, //
    {
      str: "v -4 h 1 v -3 h 2 v -8 h 2 v 8 h 4 v 7 h 20",
      lowestV: 0,
      width: 29
    },
    {
      str:
        "v -108 h 5 v -2 h 2 v -2 h 2 v -2 h 2 v -3 h 4 v -3 h 4 v -5 h 5 v 5 h 5 v 3 h 4 v 3 h 4 v 2 h 2 v 2 h 2 v 2 h 4 v 108 h 5",
      lowestV: 0,
      width: 50,
      lights: [{ x: 20, y: 125 }]
    },
    {
      str:
        "v -84 h 2 v -5 h 3 v -5 h 10 v 5 h 8 v -2 h 4 v -6 h 8 v 6 h 5 v 3 h 3 v 88 h 5",
      lowestV: 0,
      width: 48,
      lights: [
        { x: 5, y: 94 },
        { x: 27, y: 97 }
      ]
    },
    { str: "v0 h 6", lowestV: 0, width: 6 }, //
    {
      str:
        "h 15 v -52 h -10 v 1 h -2 v -3 h 1 v -1 h 12 v -2 h 2 v 2 h 40 v 2 h -35 v 3 h -3 v 50 h 15 ",
      lowestV: 0,
      width: 35,
      lights: [
        { x: 4, y: 55 },
        { x: 58, y: 55 }
      ]
    },
    {
      str:
        "v -3 h 2 c 0,-5 5,-13 20,-13 v -45 h 3 v -17 h 5 v -7 h 2 v -2 h 3 v -6 h 3 v -5 h 3 v -3 h 1 v 3 h 2 v 5 h 3 l 9,11 v 2 h 2 v 23 h 8 v 50 h 3 c 0,-5 5,-13 20,-13 c 20,5 10,15 11,20 h 5 v 0",
      lowestV: 0,
      width: 105,
      lights: [{ x: 41.5, y: 101 }]
    },
    {
      str:
        "v -5 h 5 v -48 h 1 v -5 h 4 v -5 h 3 v -2 h 35 v 1 h 4 v 5 h 3 v 7 h 1 v 40 h 5 v 1 h 10 v 4 h 8 v -1 h 5 v 8",
      lowestV: 0,
      width: 84
    },
    { str: "v 0 h 8", lowestV: 0, width: 8, heightChange: 0 }, //
    {
      str: "v -8 h 4 v -10 h 2 v -15 h 15 v 7 h 5 v 13 h 6 v 12 h 4 v 1",
      lowestV: -15,
      width: 36
    },
    {
      str: "v -12 h 3 v -1 h 13 v -25 h -5 v -1 h 68 v 1 h -3 v 38",
      lowestV: 0,
      width: 76
    },
    { str: "v 0 h 5", lowestV: 0, width: 5, heightChange: 0 }, //
    {
      str: "v 0 h 5 v 1 h 3 v -1",
      lowestV: -7,
      width: 8
    }
  ];
  useEffect(() => {
    const titleWidth = 300;
    const _cityLights = [];
    const skylineCoordsObj = buildingArray.reduce(
      (acc, _, i) => {
        const WINDOW = 1;
        const newPiece =
          buildingArray[
            getRandomIntInRange({
              min: i - WINDOW > -1 ? i - WINDOW : 0,
              max:
                i + WINDOW < buildingArray.length
                  ? i + WINDOW
                  : buildingArray.length - 1
            })
          ];
        newPiece.lights &&
          Math.random() > 0.3 &&
          newPiece.lights.forEach(lightCoords => {
            _cityLights.push(
              <StyledCircle
                cx={`${acc.currWidth + lightCoords.x}`}
                cy={`${300 - lightCoords.y}`}
                r="1"
                fill="red"
                filter="url(#sofGlow)"
                randDur={Math.random() * 3 + 1}
              />
            );
          });
        const currWidth = acc.currWidth + newPiece.width;
        const curr = {
          currWidth,
          strArr: [...acc.strArr, newPiece.str]
        };
        return curr;
      },
      {
        strArr: [],
        currWidth: 0
      }
    );
    setSkylineCoords(
      "M 0 300" + " " + skylineCoordsObj.strArr.join("") + "V 300"
    );
    setCityLights(_cityLights);
  }, []);
  return (
    <Wrapper isNavBar={isNavBar} zIndex={zIndex}>
      <svg width="750" height="300">
        <defs>
          <linearGradient id="cityFade" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#db974f" />
            <stop offset="99%" stop-color="#db974f" stop-opacity="0" />
            <stop offset="100%" stop-color="transparent" />
          </linearGradient>
          <filter id="sofGlow" height="2000%" width="2000%" x="-500%" y="-500%">
            <feMorphology
              operator="dilate"
              radius="4"
              in="SourceAlpha"
              result="thicken"
            />
            <feGaussianBlur in="thicken" stdDeviation="4" result="blurred" />
            <feFlood flood-color="rgb(201, 25, 22)" result="glowColor" />
            <feComposite
              in="glowColor"
              in2="blurred"
              operator="in"
              result="softGlow_colored"
            />
            <feMerge>
              <feMergeNode in="softGlow_colored" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d={skylineCoords}
          fill="#152642"
          stroke="#634a30"
          style={{ filter: "drop-shadow(0px -1px 50px #db974f)" }}
        />
        <path d={skylineCoords} fill="url(#cityFade)" />
        {cityLights}
      </svg>
    </Wrapper>
  );
};
// <path
//   fill="none"
//   stroke="green"
//   d="M 0,400 Q 0,355 -10,-10 t 30,0 30,0 30,0 30,0 30,0 30,0 30,0 30,0 30,0 30,0 30,0 30,0 30,0 30,0 30,0"
// />
