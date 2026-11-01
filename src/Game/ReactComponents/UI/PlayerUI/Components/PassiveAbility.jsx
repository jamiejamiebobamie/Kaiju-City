import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import { ICON_LOOKUP } from 'Utils/gameState';

const Wrapper = styled.div`
  position: absolute;
  right: 20px;
  width: 100px;
  height: 0px;
  transform: rotate(${props => props.i * -18}deg);
  transform-origin: top right;
`;
const PassiveAbilityWrapper = styled.div`
  display: flex;
  justify-content: center;
  width: 20px;
  height: 20px;
  align-self: center;
  align-content: center;
  border-radius: 100%;
  background-color: ${props => props.color};
  color: #152642;
  transform: rotate(${props => props.i * 18 - 90}deg
  );
  pointer-events: auto;
  ${props => props.isOnCooldown ? "filter: brightness(1);" : "filter: brightness(.2);"}

  -webkit-transition-duration: 0.2s;
  transition-duration: .2s;
  transition-property: brightness;

  &::before {
    content: "";
    position: absolute;
    width: 77.46px;
    height: 214px;
    pointer-events: none;

    background-position: center;

    background-color: ${props => props.color};
    -webkit-mask-image: url('spritesheet/passiveAbilityActivationSprite_TEST.png');
    mask-image: url('spritesheet/passiveAbilityActivationSprite_TEST.png');

    // background-blend-mode: multiply;
    // background-image: url('spritesheet/passiveAbilityActivationSprite_TEST.png');


    animation: ${props =>
    props.isPassiveRetriggered ?
      'play-particle .75s steps(11) 1 forwards'
      : props.isOnCooldown && !props.isPassiveRetriggered ?
        'rotate-particle 2s infinite linear'
        : 'empty-anim 1s infinite'
  };

    opacity: ${props => props.isOnCooldown ? 0.3 : 0};
    transition: opacity, transform .5s ease-in-out;
    transform: translate(0px, -176px);
  }

  @keyframes empty-anim{}

  @keyframes play-particle {
    from {
      -webkit-mask-position: 0px 214px; 
      mask-position: 0px 214px;
    }
    to {
        -webkit-mask-position: -852px 214px; 
        mask-position: -852px 214px;
    }
  }

  @keyframes rotate-particle {
    0% {
        transform-origin: 40px 10px;
        transform: scale(1) rotate(0deg) translate(5px, -176px); 
        -webkit-mask-position: 0px 214px; 
        mask-position: 0px 214px;
        opacity: .3;
    }
    
    
   25%{
        transform-origin: 40px 10px;
        transform: scale(.6) rotate(90deg) translate(5px, -176px);
        opacity: .1;
        -webkit-mask-position: 0px 214px; 
        mask-position: 0px 214px;
   } 

   50%{
        transform-origin: 40px 10px;
        transform: scale(.9) rotate(180deg) translate(5px, -176px);
        opacity: .3;
        -webkit-mask-position: 0px 214px; 
        mask-position: 0px 214px;
   } 

   
   75%{
        transform-origin: 40px 10px;
        transform: scale(.7) rotate(270deg) translate(5px, -176px);
        opacity: .1;
        -webkit-mask-position: 0px 214px; 
        mask-position: 0px 214px;
   } 

    100% {
        transform-origin: 40px 10px;
        transform: scale(1) rotate(360deg) translate(5px, -176px);
        -webkit-mask-position: 0px 214px; 
        mask-position:  0px 214px;
        opacity: .3;
    }
  }    


  //   @keyframes play-particle {
  //   from {
  //     background-position: 0px 214px;
  //   }
  //   to {
  //       background-position: -852px 214px;
  //   }
  // }

  // @keyframes rotate-particle {
  //   from {
  //       transform-origin: 40px 10px;
  //       transform: rotate(0deg) translate(5px, -176px);
  //       background-position: 0px 214px;
  //   }
  //   to {
  //       transform-origin: 40px 10px;
  //       transform: rotate(360deg) translate(5px, -176px);
  //       background-position: 0px 214px;
  //   }
  // }   


`;

const PassiveIcon = styled.i`
  display: flex;
  align-self: center;
`;

export const PassiveAbility = ({
  i,
  element,
  passiveName,
  color,
  isOnCooldown,
  isTeammate,
  accTime
}) => {

  const timeoutRef = useRef();
  const [isPassiveRetriggered, setIsPassiveRetriggered] = useState(false);

  useEffect(() => {
    clearTimeout(timeoutRef.current);
    setIsPassiveRetriggered(true);
    timeoutRef.current = setTimeout(() => {
      setIsPassiveRetriggered(false);
    }, 1000);
  }, [accTime])

  return (<Wrapper i={i}>
    <PassiveAbilityWrapper
      key={i}
      i={i}
      title={passiveName}
      color={color}
      isOnCooldown={isOnCooldown} // ensure power has been cast once (a.accTime != 0) before highlighting passive 
      isTeammate={isTeammate}
      isPassiveRetriggered={isPassiveRetriggered}
    >
      <PassiveIcon className={`fa ${ICON_LOOKUP[element]}`} />
    </PassiveAbilityWrapper>
  </Wrapper>)
}