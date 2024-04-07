// https://kinoar.github.io/rmmv-doc-web/globals.html
// https://gist.github.com/UserUnknownFactor/4e700940079109f2430078534f163504
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

    renderValue(parent, value) {
        $e("ins-argval", parent, {type: typeof value, innerText: JSON.stringify(value)});
    }

    renderArgs(parent) {
        if (this.args === undefined) return;

        if (typeof this.args !== "object") {
            this.renderValue(parent, this.args);
            return;
        }

        const argCount = Object.keys(this.args).length;
        const multiline = argCount > 2;
        for (const [i, [k, v]] of Object.entries(Object.entries(this.args))) {
            // Yes bad but whatever
            if (multiline) parent.insertAdjacentText("beforeend", "\n    ");

            $e("ins-argname", parent, {innerText: k});
            parent.insertAdjacentText("beforeend", ": ");
            this.renderValue(parent, v);

            const last = parseInt(i) === argCount - 1;
            if (!last) parent.insertAdjacentText("beforeend", ", ");
        }
    }

    toDOM(parent) {
        $e("ins-funcname", parent, {innerText: this.name});
        const argEl = $e("ins-args", parent, {innerText: "("});
        this.renderArgs(argEl);
        argEl.insertAdjacentText("beforeend", ")");
    }
}

function decodeOp(signParam, value, isConst=true) {
    const sign = !signParam ? "+" : "-";
    const val = isConst ? value : `Var[${value}]`;

    return `${sign} ${val}`;
}

function decodeMapLocation(map, x, y, isConst=true) {
    if (isConst) {
        return {
            map: map,
            x: x,
            y: y,
        };
    }

    return {
        map: `Variable[${map}]`,
        x: `Variable[${x}]`,
        y: `Variable[${y}]`,
    };
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
        case 108:
            return new Instruction("Comment", params[0]);
        case 111:
            const out = {};

            switch (params[0]) {
                // Switch
                case 0:
                    out.switchTarget = params[1];
                    out.targetValue = !params[2];
                    break;
                // Variable
                case 1:
                    out.variableTarget = params[1];
                    out.op = ["==", ">=", "<=", ">", "<", "!="][params[4]];
                    out.targetValue = params[2] === 0 ? params[3] : `Variable[${params[3]}`;
                    break;
                // Self switch
                case 2:
                    out.selfSwitchTarget = param[2];
                    out.targetValue = !params[2];
                    break;
                // Timer
                case 3:
                    out.seconds = params[1];
                    out.orQuantifier = params[2] === 0 ? "more" : "less";
                    break;
                // Actor
                case 4:
                    out.actorId = params[1];
                    switch (params[2]) {
                        case 0:
                            out.condition = "inParty";
                            break;
                        case 1:
                            out.condition = "nameIs";
                            out.targetValue = params[3];
                            break;
                        case 2:
                            out.condition = "isClass";
                            out.targetValue = params[3];
                            break;
                        case 3:
                            out.condition = "knowsSkill";
                            out.targetValue = params[3];
                            break;
                        case 4:
                            out.condition = "equipsWeapon";
                            out.targetValue = params[3];
                            break;
                        case 5:
                            out.condition = "equipsArmor";
                            out.targetValue = params[3];
                            break;
                        case 6:
                            out.condition = "hasState";
                            out.targetValue = params[3];
                            break;
                    }
                    break;
                // Enemy
                case 5:
                    out.enemyId = params[1];
                    switch (params[2]) {
                        case 0:
                            out.condition = "isVisible";
                            break;
                        case 1:
                            out.condition = "hasState";
                            out.targetValue = params[3];
                            break;
                    }
                    break;
                // Character facing direction
                case 6:
                    out.characterId = params[1];
                    out.direction = params[2];
                    break;
                case 7:
                    out.condition = "gold";
                    out.op = [">=", "<=", "<"][params[1]];
                    out.targetValue = params[2];
                    break;
                case 8:
                    out.item = params[1];
                    break;
                case 9:
                    out.weapon = params[1];
                    out.includeEquipped = !!params[2];
                    break;
                case 10:
                    out.armor = params[1];
                    out.includeEquipped = !!params[2];
                    break;
                case 11:
                    out.buttonPressed = [
                        "0",
                        "1",
                        "down",
                        "3",
                        "left",
                        "5",
                        "right",
                        "7",
                        "up",
                        "9",
                        "10",
                        "A",
                        "B",
                        "C",
                        "X",
                        "Y",
                        "Z",
                        "L",
                        "R"
                    ][params[1]];
                    break;
                case 12:
                    out.script = params[1];
                    break;
                case 13:
                    out.inVehicle = params[1];
                    break;
            }

            return new Instruction("ConditionalBranch", out);
        case 112:
            return new Instruction("Loop");
        case 113:
            return new Instruction("BreakLoop");
        case 115:
            return new Instruction("ExitEventProcessing");
        case 117:
            return new Instruction("CommonEvent", {
                id: params[0]
            });
        case 118:
            return new Instruction("Label", params[0]);
        case 119:
            return new Instruction("JumpToLabel", params[0]);
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
        case 123:
            return new Instruction("ControlSelfSwitch", {
                target: params[0],
                value: !!params[1]
            });
        case 126:
            return new Instruction("ChangeItems", {
                item: params[0],
                change: decodeOp(params[1], params[3], params[2] === 0)
            });
        case 129:
            return new Instruction("ChangePartyMember", {
                op: params[1] === 0 ? "+" : "-",
                actor: params[0],
                initalize: params[1] === 0 && params[2] === 1
            });
        case 134:
            return new Instruction("ChangeSaveAccess", {
                canAccess: !!params[0]
            });
        case 135:
            return new Instruction("ChangeMenuAccess", {
                canAccess: !!params[0]
            });
        case 137:
            return new Instruction("ChangeFormationAccess", {
                canAccess: !!params[0]
            });
        case 201:
            return new Instruction("TransferPlayer", {
                ...decodeMapLocation(
                    params[1],
                    params[2],
                    params[3],
                    params[0] === 0,
                ),
                direction: params[4]
            });
        case 205:
            return new Instruction("SetMoveRoute", "[snip]");
        case 211:
            return new Instruction("ChangeTransparency", {
                transparency: !params[0]
            });
        case 213:
            return new Instruction("ShowBalloonIcon", {
                icon: [
                    "Exclamation",
                    "Question",
                    "Music Note",
                    "Heart",
                    "Anger",
                    "Sweat",
                    "Cobweb",
                    "Silence",
                    "Light Bulb",
                    "Zzz"
                ][params[1] - 1],
                target: params[0],
                wait: !!params[2],
            });
        case 214: return new Instruction("TemporarilyEraseEvent");
        case 216:
            return new Instruction("ChangePlayerFollowers", {
                visible: params[0] === 0
            });
        case 221:
            return new Instruction("ScreenFadeOut");
        case 222:
            return new Instruction("ScreenFadeIn");
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
        case 235: return new Instruction("ErasePicture", params[0]);
        case 236:
            return new Instruction("SetWeather", {
                weather: params[0],
                power: params[1],
                frames: params[2],
                wait: params[3]
            });
        case 241: return new Instruction("PlayBGM", params[0]);
        case 242:
            return new Instruction("FadeOutBGM", {
                seconds: params[0]
            });
        case 243: return new Instruction("SaveBGM");
        case 244: return new Instruction("ResumeBGM");
        case 245: return new Instruction("PlayBGS", params[0]);
        case 246:
            return new Instruction("FadeOutBGS", {
                seconds: params[0]
            });
        case 249: return new Instruction("PlayME", params[0]);
        case 250: return new Instruction("PlaySE", params[0]);
        case 251: return new Instruction("StopSE");
        case 261: return new Instruction("PlayMovie");
        case 301:
            let troop = "map-designated";
            switch (params[0]) {
                case 0:
                    troop = params[1];
                    break;
                case 1:
                    // "Troop from xyz"
                    troop = `Variable[${params[1]}]`;
                    break;
            }
            return new Instruction("BattleProcessing", {
                troop: troop
            });
        case 313:
            return new Instruction("ChangeState", {
                actorType: params[0],
                actorId: params[1],
                op: params[2] === 0 ? "+" : "-",
                stateId: params[3],
            });
        case 314:
            return new Instruction("RecoverAll", {
                actorType: params[0],
                actorId: params[1],
            });
        case 322:
            return new Instruction("ChangeActorGraphic", {
                actor: params[0],
                character: params[1],
                characterId: params[2],
                face: params[3],
                faceId: params[4],
            });
        case 356:
            // Unofficial?
            return new Instruction("CallPluginCommand", params[0]);
        case 401:
            return new Instruction("ShowText", params[0]);
        case 402:
            return new Instruction("When", params[1]);
        case 404:
            return new Instruction("EndShowChoices");
        case 411:
            return new Instruction("ElseBranch");
        case 412:
            return new Instruction("EndConditionalBranch");
        case 413:
            return new Instruction("RepeatAbove");
        case 505:
            return new Instruction("MoveCommand");
        case 601:
            return new Instruction("IfWin");
        case 602:
            return new Instruction("IfEscape");
        case 603:
            return new Instruction("IfLose");
        case 604:
            return new Instruction("EndBattleResult");
        default:
            return new Instruction("Unknown", {
                code: inst.code,
                params: params
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

        $e("s-header", parent, {type: "page", innerText: `Page ${i}:`});
        const pageCont = $e("nested-cont", parent, {type: "event"});

        $e("s-header", pageCont, {type: "conditions", innerText: "Conditions:"});
        const conditions = $e("nested-cont", pageCont, {type: "conditions"});

        for (const condKey of ["actor", "item", "selfSwitch", "switch1", "switch2", "variable"]) {
            const cond = representCondition(page.conditions, condKey);
            if (!cond) continue;
            $e("span", conditions, {innerText: cond});
        }

        $e("s-header", pageCont, {type: "instructions", innerText: "Instructions"});
        const code = $e("nested-cont", pageCont, {type: "instructions"});

        for (const inst of page.list) {
            const decoded = decodeInstruction(inst);
            if (!decoded) continue;
            decoded.toDOM($e("inst", code));
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
        const header = $e("s-header", eventCont, {type: "event", innerText: dat.name});
        const cont = $e("nested-cont", eventCont, {type: "event", classes: ["hidden"]});
        header.cacheValid = false;

        header.addEventListener("click", function() {
            const opening = cont.classList.contains("hidden");
            if (!header.cacheValid && opening) {
                header.style.cursor = "wait";
                cont.innerHTML = "";
                makeEventElement(dat, cont);
                header.cacheValid = true;
                header.style.cursor = "auto";
            }
            cont.classList.toggle("hidden", !opening);
        });
    }

    //console.log(events);
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
