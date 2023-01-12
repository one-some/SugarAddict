export async function initRPGMaker() {
    console.log("[SA @ RPGMaker] Initializing RPGMaker backend...");

    const util = await import(browser.runtime.getURL("util.js"));

    const { makeWindow } = await import(browser.runtime.getURL("window.js"));
    const tabs = await makeWindow({
        "home": { title: "Home", icon: "🏠" },
        "stats": { title: "Stats", icon: "📊" },
        "items": { title: "Items", icon: "🏷️" },
        "vars": { title: "Variables", icon: "🔧" },
    });
}