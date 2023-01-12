browser.runtime.onMessage.addListener(function (data) {
    if (data === "init") tryInit();
});

async function tryInit() {
    // Profile current game engine. If no supported game engine is found, go home.
    if (window.wrappedJSObject.SugarCube) {
        const { initSugarCube } = await import(browser.runtime.getURL("engines/sugarcube.js"));
        await initSugarCube();
        return;
    }

    console.error("Nothing :^(");
}