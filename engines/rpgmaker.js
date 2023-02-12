const $gamePlayer = window.wrappedJSObject.$gamePlayer;
const $gameParty = window.wrappedJSObject.$gameParty;
const $dataItems = window.wrappedJSObject.$dataItems;
const $gameActors = window.wrappedJSObject.$gameActors;
const $gameTroop = window.wrappedJSObject.$gameTroop;

function log(...args) { console.log("[SA @ RPGMaker]", ...args); }

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


export async function initRPGMaker() {
    log("Initializing RPGMaker backend...");

    const { $e, $el } = await import(browser.runtime.getURL("ui/util.js"));


    function makeSettingColumn(label, valueGetter, type, parent, changeCallback, extra = null) {
        if (!["inttext", "checkbox", "floatslider"].includes(type)) throw new Error("WAAAAAAAAH");

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
                input.addEventListener("change", () => changeCallback(parseFloat(input.value)));
                break;
        }

        // Update the input periodically to reflect the setting's current value.
        if (valueGetter !== null) {
            let cacheValue = initValue;
            let fetcher = setInterval(function() {
                let value = valueGetter();

                // Do nothing if nothing has changed
                if (value === cacheValue) return;

                cacheValue = value;
                input.value = value;
            }, 200);
        }
    }

    const { makeWindow } = await import(browser.runtime.getURL("ui/window.js"));
    const tabs = await makeWindow({
        // "home": { title: "Home", icon: "🏠" },
        "player": { title: "Player", icon: "👤" },
        "party": { title: "Party", icon: "👨‍👩‍👦‍👦" },
        "items": { title: "Items", icon: "🏷️" },
        // "vars": { title: "Variables", icon: "🔧" },
    });

    $e("span", tabs.player.content, { innerText: "Position Editor", classes: ["sa-header"] });

    const moveButtons = $e("div", tabs.player.content, { classes: ["sa-movement-container"] });

    const upperButtons = $e("div", moveButtons, { classes: ["sa-movement-row"] });
    const bottomButtons = $e("div", moveButtons, { classes: ["sa-movement-row"] });

    $e("spacer", upperButtons);
    const upButton = $e("div", upperButtons, { innerText: "Up", classes: ["sa-nav-button"] });
    $e("spacer", upperButtons);
    const leftButton = $e("div", bottomButtons, { innerText: "Left", classes: ["sa-nav-button"] });
    const downButton = $e("div", bottomButtons, { innerText: "Down", classes: ["sa-nav-button"] });
    const rightButton = $e("div", bottomButtons, { innerText: "Right", classes: ["sa-nav-button"] });

    downButton.addEventListener("click", () => $gamePlayer._y++);
    upButton.addEventListener("click", () => $gamePlayer._y--);
    rightButton.addEventListener("click", () => $gamePlayer._x++);
    leftButton.addEventListener("click", () => $gamePlayer._x--);

    // Walkspeed
    makeSettingColumn(
        "Walkspeed",
        () => $gamePlayer._moveSpeed,
        "floatslider",
        tabs.player.content,
        (speed) => $gamePlayer._moveSpeed = speed,
        { min: 0, max: 6, step: 0.01 }
    )

    // Money
    makeSettingColumn(
        "Money",
        () => $gameParty._gold,
        "inttext",
        tabs.player.content,
        (money) => $gameParty._gold = money,
    )

    $e("span", tabs.player.content, { innerText: "Actions", classes: ["sa-header"] });
    const recoverButton = $e("div", tabs.player.content, { innerText: "Recover", classes: ["sa-nav-button"] });
    recoverButton.addEventListener("click", function () {
        // TODO: Probably is a better way to do this
        const playerActorId = $gameParty._actors[0];
        $gameActors.actor(playerActorId).recoverAll();
    });

    /* Party */
    $e("span", tabs.party.content, { innerText: "Actions", classes: ["sa-header"] });
    const partyRecoverButton = $e("div", tabs.party.content, { innerText: "Recover Party", classes: ["sa-nav-button"] });
    partyRecoverButton.addEventListener("click", function () {
        for (const actorId of $gameParty._actors) {
            $gameActors.actor(actorId).recoverAll();
        }
    });

    const enemyKillButton = $e("div", tabs.party.content, { innerText: "Kill Battle Enemies", classes: ["sa-nav-button"] });
    enemyKillButton.addEventListener("click", function () {
        for (const enemy of $gameTroop._enemies) {
            enemy.die();
        }
    });

    for (const member of $gameParty.allMembers()) {
        const outerMemberCont = $e("div", tabs.party.content);
        // Name
        $e("div", outerMemberCont, { innerText: member._name, classes: ["sa-rpgm-party-member"] });

        const memberCont = $e("div", outerMemberCont, { "style.marginLeft": "24px" });

        // Level
        makeSettingColumn(
            "Level (Sometimes dictates max stats)",
            () => member._level,
            "inttext",
            memberCont,
            (level) => member._level = level,
        );

        // HP
        makeSettingColumn(
            "HP",
            () => member._hp,
            "inttext",
            memberCont,
            (hp) => member._hp = hp,
        );

        // MP
        makeSettingColumn(
            "MP",
            () => member._mp,
            "inttext",
            memberCont,
            (mp) => member._mp = mp,
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
        const recoverButton = $e("div", tabs.party.content, { innerText: "Recover", classes: ["sa-nav-button"] });
        recoverButton.addEventListener("click", function () {
            member.recoverAll();
        });
    }

    /* Items */

    const itemList = $e("div", tabs.items.content, { id: "sa-rpgm-item-list" });
    const itemRightCont = $e("div", tabs.items.content, { id: "sa-rpgm-item-right" });
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
        // let oldVal = $gameParty._items[selectedItem.id] ?? 0;
        let newVal = parseInt(countInput.value);
        if (newVal) $gameParty._items[selectedItem.id] = newVal;
    });

    function updateSelectedItem(item) {
        selectedItem = item;
        itemDetails.innerHTML = "";
        $e("span", itemDetails, { innerText: item.name, classes: ["sa-header"] });
        if (item.description) $e("div", itemDetails, { innerText: item.description });
        if (item.price) $e("div", itemDetails, { innerText: `Price: ${item.price}` });
        countInput.value = $gameParty._items[item.id] ?? 0;
    }

    function drawItem(item) {
        const listEntry = $e("div", itemList, { innerText: item.name });
        listEntry.addEventListener("click", function (event) {
            updateSelectedItem(item);
        });
        return listEntry;
    }

    for (const item of $dataItems) {
        if (!item) continue;
        drawItem(item);
    }
}
