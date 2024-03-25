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

        const startButton = $e("span", row, {
            innerText: "[Jump]",
            classes: ["sa-link"],
        });
        startButton.addEventListener("click", function () {
            console.log(mapEvent);
            mapEvent.start();
            //wJS.$gameTemp._commonEventId = event.id;
            //wJS.$gameMap._interpreter.setupReservedCommonEvent();
        });
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

    const tabs = await makeWindow({
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
    // ALSO TODO: Switches
    // ALSO ALSO TODO: Map ( and events inside it)
    // https://pastebin.com/eJx0EvXB
    for (const inst of event.list) {
        console.log(inst);
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
