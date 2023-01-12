let isMinimized = false;
let dragOffset = null;
let dragEl = null;

export async function makeWindow(tabs) {
    const { $e, $el } = await import(browser.runtime.getURL("util.js"));

    const style = $e("link", document.head, {
        rel: "stylesheet",
        href: browser.runtime.getURL("window.css")
    });

    const windowContainer = $e("div", document.body, { id: "sa-window-container" });
    const topBar = $e("div", windowContainer, { id: "sa-topbar" });

    // Hack
    $e("spacer", topBar);

    const titleLabel = $e("span", topBar, { innerText: "SugarAddict" });
    const minimizeButton = $e("span", topBar, { innerText: "-", id: "sa-minimize" });

    const main = $e("div", windowContainer, { id: "sa-main" });
    const tabBar = $e("div", main, { id: "sa-tabbar" });

    const tabContentContainer = $e("div", main, { id: "sa-tab-content-container" });

    function startWindowDrag(event) {
        dragEl = this;
        this.classList.add("sa-dragging");
        let boundingRect = this.getBoundingClientRect();
        dragOffset = [event.clientX - boundingRect.left, event.clientY - boundingRect.top];
    }
    topBar.addEventListener("mousedown", startWindowDrag);
    tabBar.addEventListener("mousedown", startWindowDrag);

    document.addEventListener("mouseup", function (event) {
        // We don't care where the mouse is *released*.
        if (dragEl) dragEl.classList.remove("sa-dragging");
        dragOffset = null;
    });

    document.addEventListener("mousemove", function (event) {
        if (!dragOffset) return;
        windowContainer.style.left = `${event.clientX - dragOffset[0]}px`;
        windowContainer.style.top = `${event.clientY - dragOffset[1]}px`;
    });

    minimizeButton.addEventListener("click", function () {
        isMinimized = !isMinimized;
        minimizeButton.innerText = isMinimized ? "+" : "-";
        main.style.display = isMinimized ? "none" : "flex";
    });

    // Tabs
    function switchTab(tabId) {
        for (const tabContent of document.querySelectorAll(".sa-tab-content")) {
            tabContent.classList.add("sa-hidden");
        }
        const coolTab = $el(`.sa-tab-content[tab-id="${tabId}"]`);
        coolTab.classList.remove("sa-hidden");
        titleLabel.innerText = `${tabs[tabId].title} - SugarAddict`;
    }

    for (const [tabId, data] of Object.entries(tabs)) {
        let tab = $e("div", tabBar, { innerText: data.icon, classes: ["sa-tab-icon"] });

        tab.addEventListener("mousedown", function (event) {
            event.preventDefault();
            event.stopPropagation();
        });

        tab.addEventListener("click", function (event) {
            switchTab(tabId);
            const oldTab = $el(".sa-tab-icon.sa-selected");
            if (oldTab) oldTab.classList.remove("sa-selected");
            tab.classList.add("sa-selected");
        });

        let tabContent = $e("div", tabContentContainer, { "tab-id": tabId, classes: ["sa-tab-content", "sa-hidden"] })
        tabs[tabId].content = tabContent;
    }

    tabBar.children[0].click();
    return tabs;
}