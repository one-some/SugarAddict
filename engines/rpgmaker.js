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

    updateEvents();
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

// Events/map
const eventCont = $el("#rpgm-event-info");

class Instruction {
    constructor(name, args) {
        this.name = name;
        this.args = args;
    }

    toString() {
        let argStr = JSON.stringify(this.args);
        if (typeof this.args === "object") {
            argStr = Object.entries(this.args).map(k => `${k[0]}: ${JSON.stringify(k[1])}`).join(", ");
        }
        return `${this.name}(${argStr})`;
    }
}

function decodeOp(signParam, value, isConst=true) {
    const sign = !signParam ? "+" : "-";
    const val = isConst ? value : `Var[${value}]`;

    return `${sign} ${val}`;
}

function decodeInstruction(inst) {
    const params = inst.parameters;
    // https://pastebin.com/raw/JyRTdq0b
    // https://pastebin.com/raw/eJx0EvXB
    switch (inst.code) {
        case 0:
            return null;
        case 101:
            return new Instruction("ShowTextFace", {
                face: params[0] || "none",
                faceIndex: params[1],
                bg: ["normal", "dim bg", "transparent"][params[2]],
                location: ["top", "middle", "bottom"][params[3]]
            });
        case 102:
            return new Instruction("ShowChoices", params);
        case 103:
            return new Instruction("InputNumber", {
                storeIn: params[0]
            });
        case 104:
            return new Instruction("SelectItem", {
                storeIn: params[0]
            });
        case 111:
            return new Instruction("ConditionalBranch", {
                todo: "TODO"
            });
        case 117:
            return new Instruction("CommonEvent", {
                id: params[0]
            });
        case 118:
            return new Instruction("Label", params[0]);
        case 121:
            return new Instruction("ControlSwitches", {
                switch1: params[0],
                switch2: params[1],
                value: !!params[2],
            });
        case 122:
            const args = {
                operator: params[2]
            };

            switch (params[3]) {
                case 0:
                    args.constantValue = params[4];
                    break;
                case 1:
                    args.varSource = params[4];
                    break;
                case 2:
                    args.randomStart = params[4];
                    args.randomEnd = params[5];
                    break;
                case 3:
                    switch (params[4]) {
                        case 0:
                            args.hasItem = params[5];
                            break;
                        case 1:
                            args.hasWeapon = params[5];
                            break;
                        case 2:
                            args.hasArmor = params[5];
                            break;
                        case 3:
                            args.actorId = params[5];
                            args.actorTarget = [
                                "Level",
                                "EXP",
                                "HP",
                                "MP",
                                "MHP",
                                "MMP",
                                "ATK",
                                "DEF",
                                "MAT",
                                "MDF",
                                "AGI",
                                "LUK"
                            ][params[6]];
                            break;
                        case 4:
                            args.enemyId = params[5];
                            args.enemyTarget = [
                                "HP",
                                "MP",
                                "MHP",
                                "MMP",
                                "ATK",
                                "DEF",
                                "MAT",
                                "MDF",
                                "AGI",
                                "LUK"
                            ][params[6]];
                            break;
                        case 5:
                            args.character = params[5];
                            args.characterTarget = [
                                "x coordinate",
                                "y coordinate",
                                "direction",
                                "screen x coordinate",
                                "screen y coordinate"
                            ][params[6]];
                            break;
                        case 6:
                            args.idOfPartyMember = params[5];
                            break;
                        case 7:
                            args.otherTarget = [
                                "Map ID",
                                "Party Size",
                                "Gold",
                                "Steps",
                                "Play Time",
                                "Timer",
                                "Save Count",
                                "Battle Count"
                            ][params[5]];
                            break;
                    }
                case 4:
                    args.script = params[4];
            }

            return new Instruction("ControlVariable", args);
        case 126:
            return new Instruction("ChangeItems", {
                item: params[0],
                change: decodeOp(params[1], params[3], params[2] === 0)
            });
        case 224:
            return new Instruction("ScreenFlash", {
                color: params[0],
                frames: params[1],
                wait: params[2],
            });
        case 225:
            return new Instruction("ScreenShake", {
                power: params[0],
                speed: params[1],
                frames: params[2],
                wait: params[3],
            });
        case 230:
            return new Instruction("Wait", {
                frames: params[0]
            });
        case 231:
            return new Instruction("ShowPicture", {
                picture: params[1],
                pictureNo: params[0],
                origin: params[2] === 0 ? "top left" : "center",
                x: params[4],
                y: params[5],
                unknown: params[3],
                opacity: params[8]
            });
        case 232:
            return new Instruction("MovePicture", {
                picture: params[0],
                origin: params[2] === 0 ? "top left" : "center",
                x: params[4],
                y: params[5],
                unknown: params[3],
                opacity: params[8],
                duration: params[10]
            });
        case 235:
            return new Instruction("ErasePicture", params[0]);
        case 241:
            return new Instruction("PlayBGM", params[0]);
        case 242:
            return new Instruction("FadeOutBGM", {
                seconds: params[0]
            });
        case 245:
            return new Instruction("PlayBGS", params[0]);
        case 246:
            return new Instruction("FadeOutBGS", {
                seconds: params[0]
            });
        case 249:
            return new Instruction("PlayME", params[0]);
        case 250:
            return new Instruction("PlaySE", params[0]);
        case 251:
            return new Instruction("StopSE");
        case 261:
            return new Instruction("PlayMovie");
        case 356:
            // Unofficial?
            return new Instruction("CallPluginCommand", params[0]);
        case 401:
            return new Instruction("ShowText", params[0]);
        case 404:
            return new Instruction("EndShowChoices");
        case 411:
            return new Instruction("ElseBranch");
        case 412:
            return new Instruction("EndConditionalBranch");
        case 604:
            return new Instruction("EndBattleResult");
        default:
            return new Instruction("Unknown", {
                code: inst.code
            });
    }
}

function representCondition(con, what) {
    if (!con[what + "Valid"]) return "";
    switch (what) {
        case "actor":
            return `Actor == ${con.actorId}`;
        case "item":
            return `Item == ${con.itemId}`;
        case "selfSwitch":
            return `SelfSwitch[${con.selfSwichCh}]`;
        case "switch1":
            return `Switch[${con.switch1Id}]`;
        case "switch2":
            return `Switch[${con.switch2Id}]`;
        case "variable":
            return `Variable[${con.variableId}] == ${con.variableValue}`;
        default:
            throw new Error("What!");
    }
}

function makeEventElement(dat, parent) {
    for (const [i, page] of Object.entries(dat.pages)) {
        const pageCont = $e("div", parent, {innerText: `Page ${i}`});
        const conditions = $e("div", parent, {innerText: "Conditions"});

        for (const condKey of ["actor", "item", "selfSwitch", "switch1", "switch2", "variable"]) {
            const cond = representCondition(page.conditions, condKey);
            if (!cond) continue;
            $e("span", conditions, {innerText: cond});
        }

        const code = $e("div", parent, {innerText: "Instructions"});
        for (const inst of page.list) {
            const decoded = decodeInstruction(inst);
            if (!decoded) continue;
            $e("inst", code, {innerText: decoded});
        }
    }
}

async function updateEvents() {
    eventCont.innerHTML = "";

    const events = await Exec.pageExec(() => $gameMap.events().map(
        function(event) {
            const dbEvent = event.event();
            return {
                event: event,
                name: dbEvent.name,
                id: dbEvent.id,
                pages: dbEvent.pages,
            };
        }
    ));

    for (const dat of events) {
        const cont = $e("div", eventCont, {innerText: dat.name});
        makeEventElement(dat, cont);
    }

    console.log(events);
    $e("h1", eventCont, {innerText: "HELLO"});
}

$el('tab-content[tab="map"]').addEventListener("show", updateEvents);

// Init

(async function() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    Exec.setCurrentTab(tab.id);

    log("RPGMaker good!");

    init();
    setInterval(update, 500);
})();
