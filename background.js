import { log, error } from "./log.js";
import * as Exec from "./exec-util.js";

function PAGE$profile() {
    if (window.$gameMap) return "RPGMAKER";
    return "UNKNOWN";
}

function PAGE$dumpWindowVariables() {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    const currentWindow = Object.getOwnPropertyNames(window);

    const results = currentWindow.filter(function (prop) {
        return !iframe.contentWindow.hasOwnProperty(prop);
    });

    document.body.removeChild(iframe);

    return results;
}

Exec.uni.action.onClicked.addListener(async function (tab) {
    Exec.setCurrentTab(tab.id);
    log("Hello, Sugar.");

    const windowVars = await Exec.pageExec(PAGE$dumpWindowVariables);
    log("Window Vars:", windowVars);
    
    const engine = await Exec.pageExec(PAGE$profile);


    if (engine === "UNKNOWN") {
        error("I don't know how this game works.");
        return;
    }

    log("Let's get ready for", engine);

    switch (engine) {
        case "RPGMAKER":
            await Exec.uni.scripting.executeScript({
                target: {
                    tabId: tab.id
                },
                files: ["engines/rpgmaker.js"],
                world: "MAIN"
            });
            break;
    }
});
