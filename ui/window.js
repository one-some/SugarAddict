const WINDOW_MIN_WIDTH = 250;
const WINDOW_MIN_HEIGHT = 300;

const DragState = {
    WINDOW_POSITION: 0,
    RESIZE_BOTTOM_LEFT: 1,
    RESIZE_BOTTOM_RIGHT: 2
};

let windowContainer;
let dragState = null;
let windowResizeRectBuffer = null;
let dragOffset = null;
let dragEl = null;
let isMinimized = false;

const decache = Math.random();

document.addEventListener("keydown", function (event) {
    if (event.key === "Shift" && event.altKey) {
        windowContainer.classList.toggle("sa-hidden");
    }
});

export async function makeWindow(tabs) {
    // Remove old elements and styles
    for (const el of document.querySelectorAll(".sa-toplevel")) {
        el.remove();
    }

    const { $e, $el } = await import(browser.runtime.getURL("ui/util.js"));

    const style = $e("link", document.head, {
        rel: "stylesheet",
        href: browser.runtime.getURL("ui/window.css") + `?decache=${decache}`,
        classes: ["sa-toplevel"],
    });

    windowContainer = $e("div", document.body, {
        id: "sa-window-container",
        classes: ["sa-toplevel"],
    });

    function dontPropagate(event) {
        event.stopPropagation();
    }

    windowContainer.addEventListener("pointerdown", dontPropagate);
    windowContainer.addEventListener("mousedown", dontPropagate);
    windowContainer.addEventListener("click", dontPropagate);
    windowContainer.addEventListener("wheel", dontPropagate);

    const windowContents = $e("div", windowContainer, { id: "sa-window-contents" });

    const topBar = $e("div", windowContents, { id: "sa-topbar" });

    // Hack
    $e("spacer", topBar);

    const titleLabel = $e("span", topBar, { innerText: "SugarAddict" });
    const minimizeButton = $e("span", topBar, {
        innerText: "-",
        id: "sa-minimize",
    });

    const main = $e("div", windowContents, { id: "sa-main" });
    const tabBar = $e("div", main, { id: "sa-tabbar" });

    const tabContentContainer = $e("div", main, {
        id: "sa-tab-content-container",
    });

    function startWindowDrag(event) {
        event.preventDefault();
        dragState = DragState.WINDOW_POSITION;
        dragEl = this;
        this.classList.add("sa-dragging");
        let boundingRect = this.getBoundingClientRect();
        dragOffset = [
            event.clientX - boundingRect.left,
            event.clientY - boundingRect.top,
        ];
    }
    topBar.addEventListener("mousedown", startWindowDrag);
    tabBar.addEventListener("mousedown", startWindowDrag);

    document.addEventListener("mouseup", function (event) {
        // We don't care where the mouse is *released*.
        if (dragEl) dragEl.classList.remove("sa-dragging");
        dragOffset = null;
        dragState = null;
        windowResizeRectBuffer = null;
    });

    document.addEventListener("mousemove", function (event) {
        if (dragState !== null) {
            event.preventDefault();
        }

        if (dragState === DragState.WINDOW_POSITION) {
            windowContainer.style.left = `${event.clientX - dragOffset[0]}px`;
            windowContainer.style.top = `${event.clientY - dragOffset[1]}px`;
        } else if (dragState === DragState.RESIZE_BOTTOM_RIGHT) {
            let rect = windowContainer.getBoundingClientRect();
            let width = Math.max(event.clientX - rect.x, WINDOW_MIN_WIDTH);
            let height = Math.max(event.clientY - rect.y, WINDOW_MIN_HEIGHT);
            windowContainer.style.width = `${width}px`;
            windowContainer.style.height = `${height}px`;
        } else if (dragState === DragState.RESIZE_BOTTOM_LEFT) {
            let rect = windowContainer.getBoundingClientRect();
            let rightBoundary = windowResizeRectBuffer.x + windowResizeRectBuffer.width;
            let width = Math.max(rightBoundary - event.clientX, WINDOW_MIN_WIDTH);
            let height = Math.max(event.clientY - rect.y, WINDOW_MIN_HEIGHT);
            let left = Math.min(event.clientX, rightBoundary - WINDOW_MIN_WIDTH);
            windowContainer.style.left = `${left}px`;
            windowContainer.style.width = `${width}px`;
            windowContainer.style.height = `${height}px`;
        }
    });

    minimizeButton.addEventListener("click", function () {
        isMinimized = !isMinimized;
        minimizeButton.innerText = isMinimized ? "+" : "-";
        main.style.display = isMinimized ? "none" : "flex";
    });

    const handleCont = $e("div", windowContainer, { id: "sa-window-handle-cont" });

    const resizeHandles = {
        bottomLeft: $e(
            "div",
            handleCont,
            {
                classes: ["sa-resize-handle"],
                "style.cursor": "nesw-resize",
                "style.left": "0px",
                "style.bottom": "0px"
            }
        ),
        bottomRight: $e(
            "div",
            handleCont,
            {
                classes: ["sa-resize-handle"],
                "style.cursor": "nwse-resize",
                "style.right": "0px",
                "style.bottom": "0px"
            }
        )
    };

    resizeHandles.bottomLeft.addEventListener("mousedown", function (event) {
        event.preventDefault();
        dragState = DragState.RESIZE_BOTTOM_LEFT;
        windowResizeRectBuffer = windowContainer.getBoundingClientRect();
    });
    resizeHandles.bottomRight.addEventListener("mousedown", function (event) {
        event.preventDefault();
        dragState = DragState.RESIZE_BOTTOM_RIGHT;
        // windowResizeRectBuffer = windowContainer.getBoundingClientRect();
    });

    // Tabs
    let currentTabId;
    function switchTab(tabId) {
        if (currentTabId) {
            for (const func of tabs[currentTabId].leaveHandlers) {
                func();
            }
        }

        currentTabId = tabId;

        for (const tabContent of document.querySelectorAll(".sa-tab-content")) {
            tabContent.classList.add("sa-hidden");
        }
        const coolTab = $el(`.sa-tab-content[tab-id="${tabId}"]`);
        coolTab.classList.remove("sa-hidden");
        titleLabel.innerText = `${tabs[tabId].title} - SugarAddict`;
    }

    for (const [tabId, data] of Object.entries(tabs)) {
        let tab = $e("div", tabBar, {
            innerText: data.icon,
            classes: ["sa-tab-icon"],
        });

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

        let tabContent = $e("div", tabContentContainer, {
            "tab-id": tabId,
            classes: ["sa-tab-content", "sa-hidden"],
        });

        tabs[tabId].content = tabContent;

        tabs[tabId].focus = () => switchTab(tabId);
        tabs[tabId].leaveHandlers = [];
    }

    tabBar.children[0].click();
    return tabs;
}
