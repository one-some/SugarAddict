const CONTENT_SCRIPTS = [
    "ui/util.js",
    "ui/window.js",
    "ui/variable_editor.js",
    "main.js",
];

async function injectContentScripts(tabId) {
    // Fallback for tabs where Firefox didn't auto-inject (e.g. some file:// pages).
    for (const file of CONTENT_SCRIPTS) {
        await browser.tabs.executeScript(tabId, { file, runAt: "document_idle" });
    }
}

browser.browserAction.onClicked.addListener(async function () {
    const tabs = await browser.tabs.query({
        currentWindow: true,
        active: true,
    });

    for (const tab of tabs) {
        try {
            await browser.tabs.sendMessage(tab.id, "init");
        } catch (e) {
            console.warn(`SugarAddict: no listener in tab ${tab.id} (${tab.url}); injecting manually.`, e);
            try {
                await injectContentScripts(tab.id);
                await browser.tabs.sendMessage(tab.id, "init");
            } catch (e2) {
                console.error("SugarAddict: manual injection failed.", e2);
            }
        }
    }
});
