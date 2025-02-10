//for (const id of Object.keys(wJS.$gameMap._events)) {
//  if (!wJS.$gameMap._events[id]) continue;
//  const event = wJS.$gameMap.event(id);
//  console.log(`${id} ${event.event().name}`)
//}
//wJS.$gameMap.event(36).start()
// DECOMPILE
// ION BLAST
// for (const i in wJS.$gameSwitches._data) {
// if (wJS.$gameSwitches._data[i] === null) wJS.$gameSwitches.setValue(i, true);
// }
// wJS.$dataSystem.variables WTF
// https://pastebin.com/JyRTdq0b goldmine
// $dataMap.events[2]

const wJS = window.wrappedJSObject;
const mapCache = [];
let tabs;

function log(...args) {
    console.log("[SA @ RPGMaker]", ...args);
}

function registerIntInput(element, onChange) {
    element.addEventListener("change", function (event) {
        let value = parseInt(this.value);
        if (!value && value !== 0) return;
        onChange(value);
    });

    element.addEventListener("keydown", function (event) {
        if (event.key === "Enter") this.blur();
        event.stopPropagation();
    });
}

function updateEvents(eventList) {
    eventList.innerHTML = "";

    //for (const event of wJS.$dataCommonEvents) {
    for (const mapEvent of wJS.$gameMap.events()) {
        //const event = wJS.$gameMap.event(id);
        const row = $e("div", eventList, { classes: ["sa-spread"] });
        $e("span", row, { innerText: mapEvent.event().name });

        const block = $e("div", row);

        const startButton = $e("span", block, {
            innerText: "[Jump]",
            classes: ["sa-link", "sa-jump-btn"],
        });

        startButton.addEventListener("click", function () {
            console.log(mapEvent);
            mapEvent.start();
            //wJS.$gameTemp._commonEventId = event.id;
            //wJS.$gameMap._interpreter.setupReservedCommonEvent();
        });

        const decompButton = $e("span", block, {
            innerText: "[Code]",
            classes: ["sa-link", "sa-view-passage-btn"],
        });
        decompButton.addEventListener("click", () => decompileEvent(mapEvent));
    }
}

export async function initRPGMaker() {
    log("Initializing RPGMaker backend...");

    function makeSettingColumn(
        label,
        valueGetter,
        type,
        parent,
        changeCallback,
        extra = null
    ) {
        if (!["inttext", "checkbox", "floatslider"].includes(type))
            throw new Error("WAAAAAAAAH");

        const container = $e("div", parent, { classes: ["sa-setting-column"] });

        $e("div", container, { innerText: label, classes: ["sa-setting-title"] });

        let initValue = valueGetter === null ? null : valueGetter();

        let input;
        switch (type) {
            case "inttext":
                input = $e("input", container, { value: initValue });
                registerIntInput(input, changeCallback);
                break;
            case "checkbox":
                input = $e("input", container, { type: "checkbox", value: initValue });
                input.addEventListener("change", () => changeCallback(input.checked));
                break;
            case "floatslider":
                input = $e("input", container, {
                    type: "range",
                    value: initValue,
                    min: extra.min,
                    max: extra.max,
                    step: extra.step,
                });
                input.addEventListener("change", () =>
                    changeCallback(parseFloat(input.value))
                );
                break;
        }

        // Update the input periodically to reflect the setting's current value.
        if (valueGetter !== null) {
            let cacheValue = initValue;
            let fetcher = setInterval(function () {
                let value = valueGetter();

                // Do nothing if nothing has changed
                if (value === cacheValue) return;

                cacheValue = value;
                input.value = value;
            }, 200);
        }
    }

    tabs = await makeWindow({
        // "home": { title: "Home", icon: "🏠" },
        player: { title: "Player", icon: "👤" },
        party: { title: "Party", icon: "👨‍👩‍👦‍👦" },
        items: { title: "Items", icon: "🏷️" },
        events: { title: "Events (UNSTABLE)", icon: "📔" },
        decompiler: { title: "Decompiler", icon: "💻" },
        vars: { title: "Variables", icon: "🔧" },
        varlog: { title: "State Log", icon: "🔴" },
        // "vars": { title: "Variables", icon: "🔧" },
    });

    $e("span", tabs.player.content, {
        innerText: "Position Editor",
        classes: ["sa-header"],
    });

    const moveButtons = $e("div", tabs.player.content, {
        classes: ["sa-movement-container"],
    });

    const upperButtons = $e("div", moveButtons, { classes: ["sa-movement-row"] });
    const bottomButtons = $e("div", moveButtons, {
        classes: ["sa-movement-row"],
    });

    $e("spacer", upperButtons);
    const upButton = $e("div", upperButtons, {
        innerText: "Up",
        classes: ["sa-nav-button"],
    });
    $e("spacer", upperButtons);
    const leftButton = $e("div", bottomButtons, {
        innerText: "Left",
        classes: ["sa-nav-button"],
    });
    const downButton = $e("div", bottomButtons, {
        innerText: "Down",
        classes: ["sa-nav-button"],
    });
    const rightButton = $e("div", bottomButtons, {
        innerText: "Right",
        classes: ["sa-nav-button"],
    });

    downButton.addEventListener("click", () => wJS.$gamePlayer._y++);
    upButton.addEventListener("click", () => wJS.$gamePlayer._y--);
    rightButton.addEventListener("click", () => wJS.$gamePlayer._x++);
    leftButton.addEventListener("click", () => wJS.$gamePlayer._x--);

    // Walkspeed
    makeSettingColumn(
        "Walkspeed",
        () => wJS.$gamePlayer._moveSpeed,
        "floatslider",
        tabs.player.content,
        (speed) => (wJS.$gamePlayer._moveSpeed = speed),
        { min: 0, max: 6, step: 0.01 }
    );

    // Money
    makeSettingColumn(
        "Money",
        () => wJS.$gameParty._gold,
        "inttext",
        tabs.player.content,
        (money) => (wJS.$gameParty._gold = money)
    );

    $e("span", tabs.player.content, {
        innerText: "Actions",
        classes: ["sa-header"],
    });
    const recoverButton = $e("div", tabs.player.content, {
        innerText: "Recover",
        classes: ["sa-nav-button"],
    });
    recoverButton.addEventListener("click", function () {
        // TODO: Probably is a better way to do this
        const playerActorId = wJS.$gameParty._actors[0];
        wJS.$gameActors.actor(playerActorId).recoverAll();
    });

    /* Party */
    $e("span", tabs.party.content, {
        innerText: "Actions",
        classes: ["sa-header"],
    });
    const partyRecoverButton = $e("div", tabs.party.content, {
        innerText: "Recover Party",
        classes: ["sa-nav-button"],
    });
    partyRecoverButton.addEventListener("click", function () {
        for (const actorId of wJS.$gameParty._actors) {
            wJS.$gameActors.actor(actorId).recoverAll();
        }
    });

    const enemyKillButton = $e("div", tabs.party.content, {
        innerText: "Kill Battle Enemies",
        classes: ["sa-nav-button"],
    });
    enemyKillButton.addEventListener("click", function () {
        for (const enemy of wJS.$gameTroop._enemies) {
            enemy.die();
        }
    });

    for (const member of wJS.$gameParty.allMembers()) {
        const outerMemberCont = $e("div", tabs.party.content);
        // Name
        $e("div", outerMemberCont, {
            innerText: member._name,
            classes: ["sa-rpgm-party-member"],
        });

        const memberCont = $e("div", outerMemberCont, {
            "style.marginLeft": "24px",
        });

        // Level
        makeSettingColumn(
            "Level (Sometimes dictates max stats)",
            () => member._level,
            "inttext",
            memberCont,
            (level) => (member._level = level)
        );

        // HP
        makeSettingColumn(
            "HP",
            () => member._hp,
            "inttext",
            memberCont,
            (hp) => (member._hp = hp)
        );

        // MP
        makeSettingColumn(
            "MP",
            () => member._mp,
            "inttext",
            memberCont,
            (mp) => (member._mp = mp)
        );

        // Immortality Toggle (wish i had this)
        makeSettingColumn(
            "Immortal",
            null,
            "checkbox",
            memberCont,
            function (immortal) {
                if (immortal) {
                    member.addImmortal();
                } else {
                    member.removeImmortal();
                }
            }
        );

        // Tiny recover
        const recoverButton = $e("div", tabs.party.content, {
            innerText: "Recover",
            classes: ["sa-nav-button"],
        });
        recoverButton.addEventListener("click", function () {
            member.recoverAll();
        });
    }

    /* Items */

    const itemList = $e("div", tabs.items.content, { id: "sa-rpgm-item-list" });
    const itemRightCont = $e("div", tabs.items.content, {
        id: "sa-rpgm-item-right",
    });
    const itemDetails = $e("div", itemRightCont, { id: "sa-rpgm-item-details" });

    const floor = $e("div", itemRightCont, { id: "sa-rpgm-item-details-floor" });
    $e("span", floor, { innerText: "Count" });
    const countInput = $e("input", floor, {
        type: "number",
        min: 0,
        max: 100000,
        step: 1,
    });
    let selectedItem = null;

    countInput.addEventListener("change", function (event) {
        // let oldVal = wJS.$gameParty._items[selectedItem.id] ?? 0;
        let newVal = parseInt(countInput.value);
        if (newVal) wJS.$gameParty._items[selectedItem.id] = newVal;
    });

    function updateSelectedItem(item) {
        selectedItem = item;
        itemDetails.innerHTML = "";
        $e("span", itemDetails, { innerText: item.name, classes: ["sa-header"] });
        if (item.description)
            $e("div", itemDetails, { innerText: item.description });
        if (item.price)
            $e("div", itemDetails, { innerText: `Price: ${item.price}` });
        countInput.value = wJS.$gameParty._items[item.id] ?? 0;
    }

    function drawItem(item) {
        const listEntry = $e("div", itemList, { innerText: item.name });
        listEntry.addEventListener("click", function (event) {
            updateSelectedItem(item);
        });
        return listEntry;
    }

    for (const item of wJS.$dataItems) {
        if (!item) continue;
        drawItem(item);
    }

    // Events
    const eventList = $e("div", tabs.events.content, {
        classes: ["sa-rpgm-event-list"],
    });

    setInterval(function() {
        updateEvents(eventList);
    }, 4000);


    // Variables

    function setVariable(varID, value) {
        varID = parseInt(varID);
        console.log(varID, value);
        wJS.$gameVariables.setValue(varID, value);
    }

    function logVariableChange(k, v) {
        while (tabs.varlog.content.children.length >= 30) {
            tabs.varlog.content.firstChild.remove();
        }
        const container = $e(
            "div",
            tabs.varlog.content,
            { classes: ["sa-varlog-cont"] },
            { before: tabs.varlog.content.firstChild }
        );
        const keyEl = $e("div", container, { innerText: k });
        const valueEl = $e("div", container, { innerText: v });
    }

    const varContainer = $e("div", tabs.vars.content, {
        id: "sa-var-cont",
        classes: ["sa-scroller"],
    });
    const varSearchBar = $e("input", tabs.vars.content);

    function getVariables() {
        let out = {};

        for (let i=0; i < wJS.$dataSystem.variables.length; i++) {
            out[wJS.$dataSystem.variables[i]] = wJS.$gameVariables._data[i];
        }

        // TODO: Own tab?
        for (let i=0; i < wJS.$dataSystem.switches.length; i++) {
            out["[s] " + wJS.$dataSystem.switches[i]] = wJS.$gameSwitches._data[i];
        }
        return out;
    }
    console.log(getVariables());

    await varEditorInit(
        {
            setVariable: setVariable,
            getVariables: getVariables,
            logVariableChange: logVariableChange,
        },
        { bar: varSearchBar, container: varContainer },
        250
    );

    buildMapCache();
}

function decompileEvent(event) {
    // ALSO ALSO TODO: Map ( and events inside it)
    // https://pastebin.com/eJx0EvXB
    tabs.decompiler.focus();
    tabs.decompiler.content.innerHTML = "";

    for (const page of event.event().pages) {
        for (const inst of page.list) {
            const dec = decodeInstruction(inst);
            if (!dec) continue;
            console.log(dec);
            dec.toDOM($e("sa-inst", tabs.decompiler.content));
        }
    }
}

async function buildMapCache() {
    const url = new URL(wJS.location);
    url.search = "";
    url.pathname = url.pathname.split("/").slice(0, -1).join("/");
    const base = url.toString();

    for (const v of wJS.$dataMapInfos) {
        if (!v) continue;

        console.log("...", v.name);
        const r = await fetch(`${base}/data/Map${String(v.id).padStart(3, "0")}.json`);
        mapCache.push(await r.json());
    }

    console.log("Done!");
    console.log(mapCache);
    patternScanCodeInput();
}

function patternScanCodeInput() {
    const CODE_INPUT_NUMBER = 103;
    const CODE_CONDITIONAL_BRANCH = 111;

    // yes its bad
    // really bad

    for (const map of mapCache) {
        for (const event of map.events) {
            if (!event) continue;

            let lastCode = null;
            for (const page of event.pages) {
                for (const command of page.list) {

                    if (lastCode === CODE_INPUT_NUMBER && command.code === CODE_CONDITIONAL_BRANCH) {
                        console.log("Hmmm! @", event.name);
                        console.log(command);
                        console.log("Probably want", command.parameters[3]);

                    }
                    lastCode = command.code;
                }
            }
        }
    }
}


class Instruction {
    constructor(name, args) {
        this.name = name;
        this.args = args;
    }

    renderValue(parent, value) {
        $e("ins-argval", parent, {"sa-type": typeof value, innerText: JSON.stringify(value)});
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
