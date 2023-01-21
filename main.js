let injected = false;

browser.runtime.onMessage.addListener(function (data) {
    if (data === "init") tryInit();
});

async function tryInit() {
    // Profile current game engine. If no supported game engine is found, go home.
    if (injected) return;

    if (window.wrappedJSObject.SugarCube) {
        injected = true;
        const { initSugarCube } = await import(browser.runtime.getURL("engines/sugarcube.js"));
        await initSugarCube();
        return;
    } else if (window.wrappedJSObject.$dataActors) {
        const { initRPGMaker } = await import(browser.runtime.getURL("engines/rpgmaker.js"));
        await initRPGMaker();
    } else if (window.wrappedJSObject.Module) {
        const { initRenPyWeb } = await import(browser.runtime.getURL("engines/renpy.js"));
        await initRenPyWeb();
    } else {
        console.error("Nothing :^(");
    }
}
