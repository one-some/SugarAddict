// https://kinoar.github.io/rmmv-doc-web/globals.html
import { log, error } from "../log.js";
import * as Exec from "../exec-util.js";

function $el(x) { return document.querySelector(x); }

const currencyInput = $el("#rpgm-currency");
const gameNameLabel = $el("#game-name");
const noclipButton = $el("#rpgm-noclip");
const encountersButton = $el("#rpgm-encounters");
const speedInput = $el("#rpgm-speed");

async function update() {
    const gameName = await Exec.pageExec(() => $dataSystem.gameTitle);
    gameNameLabel.innerText = gameName;
    gameNameLabel.title = gameName;

    currencyInput.value = await Exec.pageExec(() => $gameParty.gold());
    noclipButton.setToggled(await Exec.pageExec(() => $gamePlayer.isThrough()));
    encountersButton.setToggled(await Exec.pageExec(() => $gameSystem.isEncounterEnabled()));

    speedInput.setValue(await Exec.pageExec(() => $gamePlayer.moveSpeed()));
}

currencyInput.addEventListener("change", async function() {
    await Exec.pageExec(
        (val) => $gameParty._gold = val,
        parseInt(this.value)
    );
});

noclipButton.addEventListener("toggle", async function(event) {
    await Exec.pageExec((noclip) => $gamePlayer.setThrough(noclip), event.detail.enabled);
});

encountersButton.addEventListener("toggle", async function(event) {
    if (event.detail.enabled) {
        await Exec.pageExec(() => $gameSystem.enableEncounter());
    } else {
        await Exec.pageExec(() => $gameSystem.disableEncounter());
    }
});

speedInput.addEventListener("input", async function() {
    await Exec.pageExec(
        (val) => $gamePlayer.setMoveSpeed(val),
        parseFloat(this.value)
    );
});

(async function() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    Exec.setCurrentTab(tab.id);

    log("RPGMaker good!");

    update();
})();
