import React from "react";
import styled from "styled-components";
import {
  ButtonsWrapper,
  Button,
  ButtonGroup,
  ButtonOutline,
} from "Tutorial/Components/StyledComponents";

const Wrapper = styled.div`
  position: absolute;
  z-index: 999999999;

  display: flex;
  justify-content: space-between;
  align-self: center;
  align-content: center;
  align-items: center;

  width: 100%;
  height: 100%;
  max-width: 1400px;
//   max-width: 2200px;
  max-height: 1100px;

  background-color: #0b0c0e;

  -webkit-animation-duration: 1s;
  animation-duration: 1s;

  -webkit-animation-name: fadeInUp;
  animation-name: fadeInUp;
  @keyframes fadeInUp {
    0% {
      opacity: 0;
      transform: translateY(20px);
    }
    10% {
      opacity: 0;
      transform: translateY(20px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const ImgWrapper = styled.div`
    display: flex;
    margin-left: 3%;
    // width: fit-content;
    flex-direction: column;
    max-width: 1000px;

    justify-content: flex-start;
`;

const ContentWrapper = styled.div`
    // display: flex;
    // margin-right: 5%;
    // width: fit-content;
    // align-self: flex-end;
    // align-items: center;
    // height: 80%;
    // flex-direction: column;
    // max-width: 1000px;
    // justify-content: space-around;
    // margin-bottom: 50px;


    // match screen:

    display: flex;
    margin-right: 5%;
    width: fit-content;
    align-self: center;
    -webkit-box-align: center;
    align-items: center;
    height: fit-content;
    flex-direction: column;
    max-width: 1000px;
    justify-content: space-around;
    margin-bottom: 50px;
`;

const HomeButtonWrapper = styled.div`
    display: flex;
    width: 400px;
    alignSelf: flex-start;
    margin: -45px 0px 0px 0px;
`;

const StyledImg = styled.img`
    max-height: 70dvh;
    max-width: 600px;
    object-fit: contain;
    ${props => `aspect-ratio: ${props.width} / ${props.height};`}
`;

const TextWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  //   margin: 25px 0px 0px 0px; <-- original
margin: 25px 0px 30px 0px;
  //     margin: 25px 0px 30px 0px; <-- double on match screen
  //     margin: 25px 50px; <-- single on match screen
  line-height: 60px;
  max-width: 700px;
`;

const StyledText = styled.div`
  display: flex;
  align-self: flex-start;
//   align-self: center;
//   text-alignment: center;
//   text-align: center;
//   font-alignment: center;
  margin: 5px;
  color: #db974f;
  ${props =>
    props.fontSize !== undefined &&
    `font-size: ${props.fontSize}px !important;`}
`;

const StyledBackgroundImg = styled.img`

    position: absolute;
    z-index: -1;

    ${props => `width: ${props.width};`}
    ${props => `height: ${props.height};`}

    ${props => props.styles && `${props.styles}`}
`;

/*
  - - - - - - - -

SCENE: "You are a Kaiju Warrior,", "the best of the best."

  WIRES:
    filter: opacity(.2) saturate(.4);
    position: absolute;
    z-index: -1;
    transition: transform 1.5s;
    transform: scale(1, .8) translate(400px, 0px);

    src={'./Background_Wires.png'} width={901} height={942}
  - - - - - - - -
  
SCENE: "This is your home, Kaiju City."

  src={'./Night_Cloud.png'} width={647} height={367}

  ADD ANIM: "bobbing" - - - - - -
  NIGHT CLOUD (bottom-left):
    position: absolute;
    z-index: 0;
    bottom: -70px;
    left: -300px;
    transform: scale(-.7, .7);

  NIGHT CLOUD (top-right):
    position: absolute;
    z-index: 0;
    top: -120px;
    right: -300px;
    transform: scale(-.9, -.6);
  - - - - - - - - - - - - - - - - -

  ADD ANIM: "moving off-screen left to right, off-screen" - - - - - -
  NIGHT CLOUD (moving, big cloud, front):
    position: absolute;
    z-index: 1;
    transition: transform 1.5s;
    transform: scale(.7) translate(700px, 300px);
    filter: drop-shadow(0px 500px 20px black);

  NIGHT CLOUD (moving, medium cloud, middle):
    position: absolute;
    z-index: -1;
    transition: transform 1.5s;
    transform: scale(.4) translate(600px, 340px);
    filter: drop-shadow(0px 500px 20px black); 
    
  NIGHT CLOUD (moving, little cloud, back):
    position: absolute;
    z-index: -2;
    transition: transform 1.5s;
    transform: scale(.2) translate(4000px, 600px);
    filter: drop-shadow(0px 500px 20px black);
  - - - - - - - - - - - - - - - - -

  SCENE: "Defeat the Kaiju", "and save your city!"

  src={'./Day_Cloud.png'} width={660} height={417}

  ADD ANIM: "move to position (position = bottom/top/left/right) from off-screen left, then bobbing infinite once in position" - - - - - -
  DAY CLOUD (top-left, smallest):
    position: absolute;
    z-index: -1;
    transition: transform 1.5s;
    top: -140px;
    right: 50px;
    transform: scale(-.2, 0.15) translate(0px, 0px);

  DAY CLOUD (top-right, medium):
    position: absolute;
    z-index: 1;
    transition: transform 1.5s;
    top: -120px;
    right: -200px;
    transform: scale(-.4, .35) translate(0px, 0px);

  DAY CLOUD (bottom-middle, largest):
    position: absolute;
    z-index: 1;
    transition: transform 1.5s;
    bottom: -115px;
    right: 260px;
    transform: scale(-.6, .4) translate(0px, 0px);   
  - - - - - - - - - - - - - - - - -
*/

export const FullscreenPage = ({ text, buttons, image, homeButtonOnClick = undefined, backgroundImgs=[] }) => {
  const bImgs = backgroundImgs.map(({ src, width, height, styles }) => (
    <StyledBackgroundImg key={src} src={src} width={width} height={height} styles={styles} />));
  const homeButton = homeButtonOnClick ?
    <HomeButtonWrapper>
      <ButtonGroup style={{ marginLeft: "0px" }}>
        <ButtonsWrapper>
          <Button
            onClick={homeButtonOnClick}
          >
            <ButtonOutline zIndex={1} />
            Home
          </Button>
        </ButtonsWrapper>
      </ButtonGroup>
    </HomeButtonWrapper> : null;

  return <Wrapper>
    {bImgs}
    <ImgWrapper>
      {homeButton}
      <StyledImg src={image.src} width={image.width} height={image.height} />
    </ImgWrapper>
    <ContentWrapper>
      <TextWrapper>
        {text.map(t => <StyledText key={t} fontSize={22}>{t}</StyledText>)}
      </TextWrapper>
      {<ButtonGroup>
        {buttons.map(b => <ButtonsWrapper key={b.text}>
          <Button onClick={b.onClick}>
            <ButtonOutline zIndex={1} />
            {b.text}
          </Button>
        </ButtonsWrapper>)}
      </ButtonGroup >}
    </ContentWrapper>
  </Wrapper>
}