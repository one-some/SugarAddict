// https://kinoar.github.io/rmmv-doc-web/globals.html
//
//
//
//
//
//
// $gameParty.members()[3].gainExp(10000220)
// $gameSelfSwitches.setValue([mapId, eventID, 'A'], true)
import { log, error } from "../log.js";
import * as Exec from "../exec-util.js";
import { $e, $el } from "../ui/util.js";

const currencyInput = $el("#rpgm-currency");
const gameNameLabel = $el("#game-name");
const noclipButton = $el("#rpgm-noclip");
const encountersButton = $el("#rpgm-encounters");
const speedInput = $el("#rpgm-speed");
const itemList = $el("item-list");
const itemAmountInput = $el("#rpgm-item-amount");
const winButton = $el("#rpgm-win-battle");

async function init() {
    const gameName = await Exec.pageExec(() => $dataSystem.gameTitle);
    gameNameLabel.innerText = gameName;
    gameNameLabel.title = gameName;


    let selectedItemId = null;
    let filledItem = false;
    const items = await Exec.pageExec(() => $dataItems);
    for (const item of items) {
        if (!item) continue;
        const el = $e("item", itemList, {innerText: item.name});
        el.addEventListener("click", async function() {
            $el("item-info name").innerText = item.name;
            $el("item-info desc").innerText = item.description;
            $el("item-info price").innerText = item.price;
            itemAmountInput.value = (
                await Exec.pageExec((item) => $gameParty._items[item], item.id)
            ) || 0;
            selectedItemId = item.id;
        });

        if (!filledItem) {
            el.click();
            filledItem = true;
        }
    }

    itemAmountInput.addEventListener("change", async function() {
        const amount = parseInt(this.value);
        await Exec.pageExec((item, amount) => $gameParty._items[item] = amount, selectedItemId, amount);
    });

}

async function update() {
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

noclipButton.addEventListener("toggle", function(event) {
    Exec.pageExec((noclip) => $gamePlayer.setThrough(noclip), event.detail.enabled);
});

winButton.addEventListener("click", function() {
    Exec.pageExec(() => BattleManager.processVictory());
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

    init();
    setInterval(update, 500);
})();
