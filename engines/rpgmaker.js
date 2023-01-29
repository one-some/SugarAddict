const $gamePlayer = window.wrappedJSObject.$gamePlayer;
const $gameParty = window.wrappedJSObject.$gameParty;
const $dataItems = window.wrappedJSObject.$dataItems;
const $gameActors = window.wrappedJSObject.$gameActors;
const $gameTroop = window.wrappedJSObject.$gameTroop;

export async function initRPGMaker() {
    console.log("[SA @ RPGMaker] Initializing RPGMaker backend...");

    const { $e, $el } = await import(browser.runtime.getURL("ui/util.js"));

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

    $e("span", tabs.player.content, { innerText: "Walkspeed", classes: ["sa-header"] });
    const speedSlider = $e("input", tabs.player.content, { type: "range", min: 0, max: 10, step: 0.1 });
    speedSlider.value = $gamePlayer._moveSpeed;
    speedSlider.addEventListener("input", function (event) {
        $gamePlayer._moveSpeed = speedSlider.value;
    })

    $e("span", tabs.player.content, { innerText: "Money", classes: ["sa-header"] });
    const moneyInput = $e("input", tabs.player.content, { value: $gameParty._gold });
    let moneyCache = $gameParty._gold;

    // Update money
    setInterval(function () {
        if ($gameParty._gold === moneyCache) return;
        moneyCache = $gameParty._gold;
        moneyInput.value = moneyCache;
    }, 200);

    moneyInput.addEventListener("change", function (event) {
        let cash = parseInt(moneyInput.value);
        if (!cash && cash !== 0) return;
        $gameParty._gold = cash;
    });

    moneyInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") moneyInput.blur();
        event.stopPropagation();
    });

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
    enemyKillButton.addEventListener("click", function() {
        for (const enemy of $gameTroop._enemies) {
            enemy.die();
        }
    });

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
