// ==UserScript==
// @name        SugarAddict
// @namespace   Violentmonkey Scripts
// @match       *://*.motoslave.net/*
// @grant       none
// @version     1.0
// @author      one-some
// @description Twine/SugarCube story manipulation tool
// ==/UserScript==

// *://*/*=

function $e(tag, parent, attributes, insertionLocation=null) {
    let element = document.createElement(tag);

    if (!attributes) attributes = {};

    if ("classes" in attributes) {
        if (!Array.isArray(attributes.classes)) throw Error("Classes was not array!");
        for (const className of attributes.classes) {
            element.classList.add(className);
        }
        delete attributes.classes;
    }

    for (const [attribute, value] of Object.entries(attributes)) {
        if (attribute.includes(".")) {
            let ref = element;
            const parts = attribute.split(".");

            for (const part of parts.slice(0, -1)) {
                ref = ref[part];
            }

            ref[parts[parts.length - 1]] = value;
            continue;
        }

        if (attribute in element) {
            element[attribute] = value;
        } else {
            element.setAttribute(attribute, value);
        }
    }

    if (!parent) return element;

    if (insertionLocation && Object.keys(insertionLocation).length) {
        let [placement, target] = Object.entries(insertionLocation)[0];
        if (placement === "before") {
            parent.insertBefore(element, target);
        } else if (placement === "after") {
            parent.insertBefore(element, target.nextSibling);
        } else {
            throw Error(`Bad placement ${placement}`);
        }
    } else {
        parent.appendChild(element);
    }

    return element;
}
function $el(selector) {
  return document.querySelector(selector);
}

// Init

const style = $e("style", document.head, {innerHTML: `
:root {
  /* TODO: Make these one format pleeeeeaaaaaaaase */
  --sa-window: rgb(28, 28, 28);
  --sa-topbar: rgb(76, 75, 70);
  --sa-tab: #363634;
  --sa-tabbar: #181817;
}

#sa-window-container {
  position: fixed;
  height: 300px;
  width: 300px;
  top: 0px;
  left: 0px;
  display: flex;
  flex-direction: column;
}

#sa-topbar {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--sa-topbar);
  cursor: default;
  font-family: monospace;
  user-select: none;
  color: white;
}

#sa-topbar.dragging {
  cursor: grabbing;
}

#sa-minimize {
  float: right;
  margin-right: 5px;
  cursor: pointer;
}

#sa-main {
  flex-grow: 1;
  display: flex;
  flex-direction: row;
  background-color: var(--sa-window);
}

#sa-tabbar {
  background-color: var(--sa-tabbar);
}

.sa-tab-icon {
  background-color: var(--sa-tab);
  width: 32px;
  height: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 16px;
  cursor: pointer;
  margin-bottom: 1px;
  opacity: 0.4;
  user-select: none;
}

.sa-tab-icon.selected {
  opacity: 1.0;
}

#sa-tab-content-container { flex-grow: 1; }

.sa-tab-content {
  color: white;
  font-family: monospace;
  width: 100%;
  height: 100%;
}
`});

const windowContainer = $e("div", document.body, {id: "sa-window-container"});
const topBar = $e("div", windowContainer, {id: "sa-topbar"});

// Hack
$e("spacer", topBar);

const label = $e("span", topBar, {innerText: "SugarAddict"});
const minimizeButton = $e("span", topBar, {innerText: "-", id: "sa-minimize"});

const main = $e("div", windowContainer, {id: "sa-main"});

const tabBar = $e("div", main, {id: "sa-tabbar"});
const tabs = {
  "vars": {icon: "🔧"},
  "passages": {icon: "📔"},
};

const tabContentContainer = $e("div", main, {id: "sa-tab-content-container"});

var isMinimized = false;
var dragOffset = null;

topBar.addEventListener("mousedown", function(event) {
  topBar.classList.add("dragging");
  let boundingRect = topBar.getBoundingClientRect();
  dragOffset = [event.clientX - boundingRect.left, event.clientY - boundingRect.top];
});

document.addEventListener("mouseup", function(event) {
  // We don't care where the mouse is *released*.
  topBar.classList.remove("dragging");
  dragOffset = null;
});

document.addEventListener("mousemove", function(event) {
  if (!dragOffset) return;
  windowContainer.style.left = `${event.clientX - dragOffset[0]}px`;
  windowContainer.style.top = `${event.clientY - dragOffset[1]}px`;
});

minimizeButton.addEventListener("click", function() {
  isMinimized = !isMinimized;
  minimizeButton.innerText = isMinimized ? "+" : "-";
  main.style.display = isMinimized ? "none" : "block";
});

/* - Tabs - */

function switchTab(tabId) {
  for (const tabContent of document.querySelectorAll(".sa-tab-content")) {
    tabContent.style.display = "none";
  }
  const coolTab = $el(`.sa-tab-content[tab-id="${tabId}"]`);
  coolTab.style.display = "block";
}

for (const [tabId, data] of Object.entries(tabs)) {
  let tab = $e("div", tabBar, {innerText: data.icon, classes: ["sa-tab-icon"]});

  tab.addEventListener("click", function() {
    switchTab(tabId);
  });

  let tabContent = $e("div", tabContentContainer, {"tab-id": tabId, classes: ["sa-tab-content"], "style.display": "none"})
  tabs[tabId].content = tabContent;
  tabContent.innerText = tabId;
}

tabBar.children[0].click();