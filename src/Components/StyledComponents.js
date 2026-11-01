import styled from "styled-components";

export const Wrapper = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-self: center;
  align-items: center;
  width: 750px;
  min-width: 750px;
  height: 900px;
  min-height: 800px;
  ${props =>
    props.scale &&
    props.translate &&
    `transform: ${props.scale} ${props.translate}; cursor:pointer;`};
`;
export const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  height: 190px;
  padding-top: 20px;
  margin-top: 200px;
  transform: scale(1.2, 1.5);


  width: fit-content;
  z-index: 2;  

  // background-color: #18324c;
  // border-radius: 10px;
  // border-color: #18434c;
  // border-width: 1px;
  // border-style: solid;
  // border-bottom: 1px solid #13142e;


`;
export const ButtonsWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  width: 100%;
  height: 100px;
`;

export const Button = styled.div`
  display: flex;
  align-self: center;
  justify-content: center;
  width: 200px;
  min-width: 200px;
  height: 20px;

  font-alignment: center;
  cursor: pointer;

  border-radius: 5px;
  border-style: solid;

  border: 3px solid #5a8a7a;
  border-bottom: 5px solid #5a8a7a;
  color: #5a8a7a;
  filter: drop-shadow(0px 3px 1px black);

  &:hover {
    ${props => props.disabled ? ''  : `border-bottom: 3px solid #5a8a7a;
    transform: translate(0px, 3px);
    filter: drop-shadow(0px 0px 0px black);` }
  }

  font-size: 15px;
  text-stroke: 0.5px black;
  -webkit-text-stroke: 0.5px black;
  background-color: #376e5b;

  ${props => props.disabled && `filter: hue-rotate(180deg); cursor: not-allowed;`}
`;
export const ButtonOutline = styled.div`
  position: absolute;
  z-index: ${props => props.zIndex};
  width: 200px;
  min-width: 200px;
  height: 19.5px;
  margin-top: -0.5px;
  pointer-events: none;
  border-radius: 3px;
  border: 0.75px solid black;
  border-right: 0.3px solid black;
  border-left: 0.3px solid black;
  border-bottom: 0.5px solid black;
`;
export const StyledLink = styled.a`
  border-color: #5a8a7a;
  color: #5a8a7a;
  /* color: #64939b; */
  text-decoration: none;
  text-stroke: 0.5px black;
  -webkit-text-stroke: 0.5px black;
`;
export const StyledIcon = styled.i`
  margin-left: 5px;
  color: #5a8a7a;
  transform: scale(1.2, 1);
`;
export const Title = styled.div`
  align-self: center;
  position: absolute;
  z-index: 10;
  font-size: 40px;
  border-color: #64939b;
  color: #64939b;
  // margin-bottom: 100px;
  transform: scale(1.5);
  // margin-top: -344px;
  pointer-events: none;
  /* isDescription */
  ${props =>
    props.isDescription &&
    `margin-left: 120px; transform: scale(1.2); margin-top: -75px;
    -webkit-animation-duration: 1s;
    animation-duration: 1s;
    -webkit-animation-name: fadeIn;
    animation-name: fadeIn;
    @keyframes fadeIn {
      0% {
        opacity: 0;
      }
      10% {
        opacity: 0;
      }
      100% {
        opacity: 1;
      }
  }`}
`;
export const StyledSpookyText = styled.p`
  font-family: green_fuz;
  font-size: 90px;
  -webkit-text-fill-color: transparent;

  filter: drop-shadow(0 0 0.2rem purple);
  color: black;

  // -webkit-text-stroke: 1.1px purple;
  -webkit-text-stroke: 2px purple;
  filter: drop-shadow(0px 1px 2px purple);

  ${props =>
    props.isDescription &&
    "-webkit-text-stroke: 1px purple; filter: drop-shadow(0 0 0.2rem purple);"}
`;
export const StyledSciFiText = styled.p`
  font-family: Metro;
  margin-top: -110px;
  font-size: 43px;
  color: #621d75;
  text-stroke: 1px black;
  -webkit-text-stroke: 1px black;
  filter: drop-shadow(3px 3px 1px black);
`;

export const StyledSpookyTextShadow = styled.p`
  position: absolute;
  z-index: -1;
  font-family: green_fuz;
  font-size: 90px;
  top: 0px;
  color: black;
`;
export const StyledSciFiTextShadow = styled.p`
  position: absolute;
  z-index: -1;
  font-family: Metro;
  margin-top: -101px;
  font-size: 43px;
  text-shadow: 3px 6px;
  color: black;
`;
export const StyledStaticLogo = styled.img`
  cursor: pointer;
  width: 400px;
`;
export const BannerImg = styled.img`
  position: absolute;
  ${props => props.zIndex && `z-index: ${props.zIndex};`}
  ${props => props.marginLeft && `margin-left: ${props.marginLeft}px;`}
    ${props => props.marginTop && `margin-top: ${props.marginTop}px;`}
  // border-radius: 5px;
  // border-style: solid;
  // border-thickness: thick;
  // border-color: #db974f;
  // filter: drop-shadow(0px -2px 2px black);
  filter: drop-shadow(0px -1px 1px #db974f);

`;
export const Oval = styled.div`
  position: absolute;
  z-index: -3;
  margin-top: -550px;
  border-radius: 50%;
  width: 300px;
  height: 300px;
  // background-color: #db974f;
  background-color: #ffffbf;

  // background-color: #c73341;
  // background-color: #621d75;

  //linear-gradient(45deg, #d22b2b, #880808);

  opacity: 0.5;
  // border-style: solid;
  // border-width: 30px;
  // border-color: #621d75;
  // border: solid 4px #621d75;
  // border: solid 4px black;
  filter: drop-shadow(0px -2px 2px #db974f);
`;
export const Rectangle = styled.div`
  position: absolute;
  z-index: -3;
  margin-top: -257px;
  width: 400px;
  height: 150px;
  background-color: #0b0c0e;
`;
// export const Cloud = styled.img`
//   position: absolute;
//   z-index: -2;
//   ${props => props.marginTop && `margin-top: ${props.marginTop}px;`}
//   ${props =>
//     props.marginLeft &&
//     `margin-left: ${props.marginLeft}px;`}
//   transform: scale(0.7);
//   filter: invert(75%);
//   // drop-shadow(0px 0px 20px #b5d9fe)
//   // background: #c7e2fe;
// `;

export const Cloud = styled.img`
  position: absolute;
  // z-index: -2;
  ${props => props.width && `width: ${props.width}px;`}
  height:15px;
  border-radius: 15px;
  ${props => props.marginTop && `margin-top: ${props.marginTop}px;`}
  ${props =>
    props.marginLeft &&
    `margin-left: ${props.marginLeft}px;`}
  background-color: #b5d9fe;
  box-shadow: 15px 15px 20px black;
`;
