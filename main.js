let injected = false;

// Causes some errors sometimes
// patchCleverTricks();

browser.runtime.onMessage.addListener(function (data) {
    if (data === "init") tryInit();
});

function patchCleverTricks() {
    // Some developers are sneaky and try to prevent editing of
    // certain variables. That hurts my feelings!
    //
    // A downside of this is that it might break stuff other stuff on random websites, since it needs to inject fast. Oops.
    
    let _defineProperty = window.wrappedJSObject.Object.defineProperty;
    function _new_DefProp(obj, prop, descriptor) {
        // if (descriptor.configurable === false) {
        //     console.log(prop, "doesnt want to configure!");
        //     descriptor.configurable = true;
        // }

        if (descriptor.writable === false) {
            console.log(prop, "doesnt want to write!");
            descriptor.writable = true;
        }

        return _defineProperty(obj, prop, descriptor);
    }
    exportFunction(_new_DefProp, window, { defineAs: "SA_NEWDEFPROP" });
    window.wrappedJSObject.Object.defineProperty = window.wrappedJSObject.SA_NEWDEFPROP;
}

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
