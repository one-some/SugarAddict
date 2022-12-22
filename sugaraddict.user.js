// ==UserScript==
// @name        SugarAddict
// @namespace   Violentmonkey Scripts
// @match       *://*/*
// @grant       none
// @version     1.0
// @author      one-some
// @description Twine/SugarCube story manipulation tool
// ==/UserScript==
// @match    *://*/*


/* TODO:
 * Editable values
 * "Decompile passage" -- translate into english-ish
 * Display many types of objects (including branching objects)
 * show variables that changed in the last turn
 * Passage search
 * Passage change
 */

if (!window.SugarCube) {
  throw Error("No SugarCube :(");
}

// window.SugarCube.State.active.variables;

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

const scLoaded = new Event("sc-load");
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
  height: 400px;
  width: 600px;
  top: 0px;
  left: 0px;
  display: flex;
  flex-direction: column;
  z-index: 999999;
}

#sa-topbar {
  width: 100%;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--sa-topbar);
  cursor: default;
  font-family: monospace;
  user-select: none;
  color: white;
}

.sa-dragging {
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
  height: 100%;
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

.sa-tab-icon.sa-selected {
  opacity: 1.0;
}

#sa-tab-content-container {
  flex-grow: 1;
  overflow-y: auto;
  padding-right: 12px;
}

.sa-tab-content {
  color: white;
  font-family: monospace;
  width: 100%;
  height: 100%;
}

.sa-var-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
}

.sa-contracted { display: none; }
.sa-clickable { cursor: pointer; }
.sa-note {
  opacity: 0.4;
  font-style: italic;
}

.sa-var-value {
  max-height: calc(line-height);
  text-overflow: ellipsis;
  overflow: hidden;
}

.sa-var-type {
  font-size: 10px;
  opacity: 0.4;
  margin-right: 3px;
}

.sa-angry { color: red; }
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
var dragEl = null;

var startInterval = setInterval(function() {
  if (!SugarCube.State) return;
  document.dispatchEvent(scLoaded);
  clearInterval(startInterval);
  console.info("SugarCube loaded")
}, 100);

var monitoringInterval = setInterval(watchForChanges, 250);


function startWindowDrag(event) {
  dragEl = this;
  this.classList.add("sa-dragging");
  let boundingRect = this.getBoundingClientRect();
  dragOffset = [event.clientX - boundingRect.left, event.clientY - boundingRect.top];
}
topBar.addEventListener("mousedown", startWindowDrag);
tabBar.addEventListener("mousedown", startWindowDrag);

document.addEventListener("mouseup", function(event) {
  // We don't care where the mouse is *released*.
  if (dragEl) dragEl.classList.remove("sa-dragging");
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
  main.style.display = isMinimized ? "none" : "flex";
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

  tab.addEventListener("mousedown", function(event) {
    event.preventDefault();
    event.stopPropagation();
  });

  tab.addEventListener("click", function(event) {
    switchTab(tabId);
    const oldTab = $el(".sa-tab-icon.sa-selected");
    if (oldTab) oldTab.classList.remove("sa-selected");
    tab.classList.add("sa-selected");
  });

  let tabContent = $e("div", tabContentContainer, {"tab-id": tabId, classes: ["sa-tab-content"], "style.display": "none"})
  tabs[tabId].content = tabContent;
}

tabBar.children[0].click();

/* - Change Watcher - */
let cachedChanges = {};

function findVariableChanges(variables) {
  if (!cachedChanges.variables) {
    cachedChanges.variables = structuredClone(variables);
    return {};
  }

  let before = flattenKV(cachedChanges.variables);
  let after = flattenKV(variables);

  let changes = {};
  for (const [k, v] of Object.entries(after)) {
    if (before[k] !== v) changes[k] = v;
  }
  cachedChanges.variables = structuredClone(variables);

  return changes;
}

function watchForChanges() {
  // Passage title
  let title = window.SugarCube.State.active.title;
  if (title !== cachedChanges.title) {
    document.dispatchEvent(new CustomEvent(
      "sc-passagechange",
      {detail: title}
    ))
    cachedChanges.title = title;
  }

  // Variable changes
  let variables = window.SugarCube.State.active.variables;
  let changes = findVariableChanges(variables);
  for (const [k,v] of Object.entries(changes)) {
    let el = $el(`[var-path="${k}"] > .sa-var-value`);
    if (el) el.innerText = v;
    console.log(el, k, "->", v);
  }
}

/* - Twine Vars - */

function flattenKV(object, key=null) {
  let flat = {};
  let kBase = key ? `${key}.` : "";

  for (let [k, v] of Object.entries(object)) {
    if (typeof v === "object" && v !== null) {
      for (const [flatK, flatV] of Object.entries(flattenKV(v, k))) {
        flat[kBase + flatK] = flatV;
      }
    } else {
      flat[kBase + k] = v;
    }
  }
  return flat;
}

function getRecursionCSSColor(recursionLevel, index) {
  let v = 28 + (recursionLevel * 10);
  if (index % 2 === 0) v += 3;
  return `rgb(${[v,v,v].join(",")})`;
}

function setVariable(path, value) {
  let ref = window.SugarCube.State.active.variables;

  for (const part of path.slice(0, -1)) {
    ref = ref[part];
  }

  ref[path[path.length - 1]] = value;
}

function cast(value, type) {
  if (type === "null") return value; // ¯\_(ツ)_/¯
  if (type === "string") return value.toString();
  if (type === "boolean") {
    const caster = {"true": true, "false": false};
    if (caster[value] === undefined) throw Error("Bad bool");
    return caster[value];
  }
  if (type === "number") {
    let n = Number(value);
    // Because of course you can't check if x === NaN, that would be ridiculous!
    if (isNaN(n) || n === null) throw Error("Bad number");
    return n;
  }

  throw Error(type);
}

function renderVariable(key, value, parent, index, familyTree=null, recursionLevel=0, dimKey=false) {
  familyTree = [...(familyTree || []), key];

  let container = $e("div", parent, {
    classes: ["sa-var-container"],
    "var-path": familyTree.join("."),
  });

  container.style.backgroundColor = getRecursionCSSColor(recursionLevel, index);


  let type = "?";
  if (value === null) {
    type = "null";
  } else if (typeof value === "boolean") {
    type = "boolean";
  } else if (typeof value === "number") {
    type = "number";
  } else if (typeof value === "string") {
    type = "string";
  } else if (value instanceof Array) {
    type = "array";
  } else if (value.constructor.name === "Object") {
    type = "object";
  }

  let visualType = {
    "null": "0",
    boolean: "b",
    number: "#",
    string: "s",
    array: "a",
    object: "o",
  }[type] || "?";

  let leftSide = $e("div", container);

  let typeLabel = $e("span", leftSide, {innerText: `[${visualType}]`, classes: ["sa-var-type"]});

  let keyLabel = $e("span", leftSide, {innerText: key});
  if (dimKey) keyLabel.style.opacity = "0.4";

  let hasChildren = (value !== null && value.constructor.name === "Object") || value instanceof Array;
  let valueLabel = $e("span", container, {innerText: hasChildren ? ">" : value, classes: ["sa-var-value"]});

  if (!hasChildren && type !== "?") {
    let knownWorking = value;
    valueLabel.setAttribute("contenteditable", "true");

    valueLabel.addEventListener("keydown", function(event) {
      valueLabel.classList.remove("sa-angry");
      if (event.key === "Enter") valueLabel.blur();
    });

    valueLabel.addEventListener("blur", function(event) {
      try {
        let value = cast(valueLabel.innerText, type);
        setVariable(familyTree, value);
        knownWorking = value;
      } catch(err) {
        valueLabel.innerText = knownWorking;
        valueLabel.classList.add("sa-angry");
      }
    });

    container.addEventListener("click", function() {
      valueLabel.focus();
    });
  } else if (hasChildren) {
    // Special cases for array and object
    container.classList.add("sa-clickable")

    let dimChildKey = value instanceof Array;
    let childContainer = $e("div", parent, {classes: ["sa-var-folder", "sa-contracted"], "style.borderLeft": "1px solid", "style.borderColor": "blue"});
    let i = 0;
    for (const [key, item] of Object.entries(value)) {
      let cont = renderVariable(key, item, childContainer, i, familyTree, recursionLevel+1, dimChildKey);
      cont.style.paddingLeft = `${recursionLevel+1 * 12}px`;
      i++;
    }

    if (!childContainer.children.length) {
      $e("div", childContainer, {innerText: "empty", classes: ["sa-var-container", "sa-note"]})
    }

    container.addEventListener("click", function() {
      let contracted = childContainer.classList.contains("sa-contracted");

      if (contracted) {
        childContainer.classList.remove("sa-contracted");
      } else {
        childContainer.classList.add("sa-contracted");
      }
    });
  }

  return container;
}

document.addEventListener("sc-load", function() {
  let i = 0;
  for (const [key, value] of Object.entries(window.SugarCube.State.active.variables)) {
    renderVariable(key, value, tabs.vars.content, i);
    i++;
  }
});

/* - Passage Data - */
const currentPassageLabel = $e("p", tabs.passages.content);
document.addEventListener("sc-passagechange", function(event) {
  currentPassageLabel.innerText = event.detail;
});
