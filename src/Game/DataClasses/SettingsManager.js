import { Difficulty, GameMode, TILE_STATUSES_AND_ABILITY_DATA } from 'Utils/gameState';
import { GameBoardTileStatusAndAbilityData } from 'Game/DataClasses/GameBoard/Tile/GameBoardTileStatusAndAbilityData';
import { GameBoardPieceAbility } from 'Game/DataClasses/GameBoard/Pieces/GameBoardPieceAbility';
import { getRandomIntInRange } from 'Game/utils'

/*
    collection of settings data that may need to exist prior to Game init
*/
export class SettingsManager {
    constructor() {
        this.abilityEdits = {};
        this.playerAvatar = 'guy';
        this.isTeammate = true;
        this.playerChosenAbilityElements = [];
        this.gameMode = GameMode.StoryPlusTutorial;
        this.difficulty = Difficulty.Medium;

        /*
            FLYWEIGHT of ~11 ability/status data
        */
        this.abilityAndTileStatusData = {};
    }

    getAbilityAndTileStatusData = () => {
        return this.abilityAndTileStatusData;
    }

    getPlayerAvatar() {
        return this.playerAvatar;
    }

    getIsTeammate() {
        return this.isTeammate;
    }

    setIsTeammate(isTeammate) {
        this.isTeammate = isTeammate;
    }

    setDifficulty(difficulty) {
        this.difficulty = difficulty;
    }

    getAbilityEdits() {
        return this.abilityEdits;
    }

    updateAbility(edit) {
        this.abilityEdits = { ...this.abilityEdits, ...edit };
    }

    initAbilityStatusData() {
        const abilityAndTileStatusData = TILE_STATUSES_AND_ABILITY_DATA.reduce((acc, statusData) => {
            const { appliedStatus } = statusData;
            const playerEdits = !!this.abilityEdits[appliedStatus] ? this.abilityEdits[appliedStatus] : {};
            const gameBoardTileStatusAndAbilityData = new GameBoardTileStatusAndAbilityData({ ...statusData, ...playerEdits });
            acc[appliedStatus] = gameBoardTileStatusAndAbilityData;
            return acc;
        }, {});
        this.abilityAndTileStatusData = abilityAndTileStatusData;
    }

    setAbilityEdits(abilityEdits) {
        this.abilityEdits = abilityEdits;
    }

    getSortedPlayerChosenAbilityElementsString() {
        return this.playerChosenAbilityElements;
    }

    setSortedPlayerChosenAbilityElementsString(abilityElements) {
        this.playerChosenAbilityElements = abilityElements;
    }

    getPlayerChosenAbilities() {
        return this.playerChosenAbilityElements.map(element => {
            // I'm assuming the element is always found...
            const gameBoardPieceAbilityData = Object.values(this.abilityAndTileStatusData).find(ability => element == ability.getElementUppercase());
            return new GameBoardPieceAbility({ gameBoardPieceAbilityData });
        });
    }

    getThreeRandomAbilities() {
        const attackAbilities = Object.values(this.abilityAndTileStatusData).filter(({ type }) => type[0] == 'offensive');
        const defensiveAbilities = Object.values(this.abilityAndTileStatusData).filter(({ type }) => type[0] == 'defensive');
        const utilityAbilities = Object.values(this.abilityAndTileStatusData).filter(({ type }) => type[0] != 'defensive' && type[0] != 'offensive');

        const firstAbility = attackAbilities[getRandomIntInRange({ max: attackAbilities.length - 1 })];
        const secondAbility = defensiveAbilities[getRandomIntInRange({ max: defensiveAbilities.length - 1 })];
        let thirdAbility;

        // TO-DO: do fisher-yates shuffle for: 'attackAbilities' and 'defensiveAbilities' to NOT pick the same ability twice
        const rand = getRandomIntInRange({ max: 2 });
        switch (rand) {
            case 0:
                thirdAbility = attackAbilities[getRandomIntInRange({ max: attackAbilities.length - 1 })];
                break;
            case 1:
                thirdAbility = defensiveAbilities[getRandomIntInRange({ max: defensiveAbilities.length - 1 })];
                break;
            case 2:
                thirdAbility = utilityAbilities[getRandomIntInRange({ max: utilityAbilities.length - 1 })];
                break;
        }

        return [firstAbility, secondAbility, thirdAbility].map(abilityData => {
            return new GameBoardPieceAbility({ gameBoardPieceAbilityData: abilityData });
        });
    }

    getKaijuAbilities = (accTime) => {
        // only one kaiju ability for the time being...
        const kaijuAbilityData = Object.values(this.abilityAndTileStatusData).find(({ element }) => element == 'kaijuFire')
        return [new GameBoardPieceAbility({ gameBoardPieceAbilityData: kaijuAbilityData, accTime })];
    }

    updatePlayerAvatar(playerAvatar) {
        this.playerAvatar = playerAvatar;
    }

    getDifficulty = () => {
        return this.difficulty;
    }

    updateDifficulty(difficulty = 'Medium') {
        this.difficulty = this.findKey(difficulty, Difficulty, 'Medium');
    }

    getGameMode() {
        return this.gameMode;
    }

    updateGameMode(gameMode = 'StoryPlusTutorial') {
        this.gameMode = this.findKey(gameMode, GameMode, 'StoryPlusTutorial');
    }

    findKey(key, enumObject, defaultKey) {
        const k = Object.keys(enumObject).find(k => k == key)
        return enumObject[k] != undefined ? enumObject[k] : defaultKey;
    }
}