let currentTabId;
export const uni = chrome;

export function setCurrentTab(id) {
    currentTabId = id;
}

export async function pageExec(func) {
    if (!currentTabId) throw new Error("Expected currentTabId");

    const out = await uni.scripting.executeScript({
        target: {
            tabId: currentTabId
        },
        func: func,
        world: "MAIN",
    });

    return out[0].result;
}
