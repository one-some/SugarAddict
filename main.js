let injected = false;

browser.runtime.onMessage.addListener(function (data) {
    if (data === "init") tryInit();
});

function getWindowVariables() {
    // Genius solution by jungy
    // https://stackoverflow.com/a/17246535

    // Make a clean slate window--no custom properties
    let iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    // Here's our (tainted) property list
    let currentWindow = Object.getOwnPropertyNames(window.wrappedJSObject);

    // Filter based on presence in clean slate
    let results = currentWindow.filter(function(prop) {
        return !iframe.contentWindow.hasOwnProperty(prop);
    });

    document.body.removeChild(iframe);

    return results;
}

async function tryInit() {
    // Profile current game engine. If no supported game engine is found, go home.
    if (injected) return;

    let vars = getWindowVariables();
    console.log(vars);

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
