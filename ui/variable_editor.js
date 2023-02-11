let cachedChanges = {};
let lockedVariables = {};
let monitoringInterval;

function $e() { }
function $el() { }
function setVariable() { }
function getVariables() { }
function logVariableChange() { }

export async function varEditorInit(setVar, getVars, logVarChange, searchBar) {
    // kinda yucky
    const v = await import(browser.runtime.getURL("ui/util.js"));
    $e = v.$e;
    $el = v.$el;

    setVariable = setVar;
    getVariables = getVars;
    logVariableChange = logVarChange;

    monitoringInterval = setInterval(variableChangeWatchdog, 250);

    searchBar.addEventListener("input", function () {
        let query = processForSearch(searchBar.value);

        for (const varContainer of document.getElementsByClassName("sa-toplevel-var")) {
            // Show all if no query
            if (!query) {
                varContainer.classList.remove("sa-hidden");
                continue;
            }

            let name = processForSearch(varContainer.querySelector(".sa-var-name").innerText);
            let value = processForSearch(varContainer.querySelector(".sa-var-value").innerText);

            // If name or value match, show. Otherwise hide
            varContainer.classList.toggle("sa-hidden", !(name.includes(query) || value.includes(query)))
        }
    });
}

function processForSearch(string) {
    string = string.toLowerCase();
    // string = string.replaceAll(/\s/g, ""); // Slow? :b
    string = string.replaceAll(" ", "");
    string = string.replaceAll("\n", "");
    return string;
}

function findVariableChanges(variables) {
    if (!cachedChanges.flatVars) {
        cachedChanges.flatVars = structuredClone(flattenKV(variables));
        return {};
    }

    let after = flattenKV(variables);

    // Keep locked variables in check
    for (const [varPath, lockValue] of Object.entries(lockedVariables)) {
        if (after[varPath] === lockValue) continue;

        console.log("LOCKEDUPDATE", varPath, lockValue);
        setVariable(varPath.split("."), lockValue);
        after[varPath] = lockValue;
    }

    let changes = {};
    for (const [k, v] of Object.entries(after)) {
        if (cachedChanges.flatVars[k] !== v) changes[k] = v;
    }
    cachedChanges.flatVars = after;

    return changes;
}

/* Variable Processing */

function isObjectFlattenable(object) {
    if (typeof object === "function") return false;
    return true;
}

function flattenKV(object, key = null) {
    // Ignores some values completely (see isObjectFlattenable)
    let flat = {};
    let kBase = key ? `${key}.` : "";

    for (let [k, v] of Object.entries(object)) {
        if (typeof v === "object" && v !== null) {
            for (const [flatK, flatV] of Object.entries(flattenKV(v, k))) {
                if (!isObjectFlattenable(flatV)) continue;
                flat[kBase + flatK] = flatV;
            }
        } else {
            if (!isObjectFlattenable(v)) continue;
            flat[kBase + k] = v;
        }
    }
    return flat;
}

function getRecursionCSSColor(recursionLevel, index) {
    let v = 28 + (recursionLevel * 10);
    if (index % 2 === 0) v += 3;
    return `rgb(${[v, v, v].join(",")})`;
}

function cast(value, type) {
    if (type === "null") return value; // ¯\_(ツ)_/¯
    if (type === "string") return value.toString();
    if (type === "boolean") {
        const caster = { "true": true, "false": false };
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

export function renderVariable(key, value, parent, index, familyTree = null, recursionLevel = 0, dimKey = false) {
    familyTree = [...(familyTree || []), key];
    let varPath = familyTree.join(".");

    let container = $e("div", parent, {
        classes: ["sa-var-container"],
        "var-path": varPath,
    });

    if (recursionLevel === 0) container.classList.add("sa-toplevel-var");

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

    let typeLabel = $e("span", leftSide, { innerText: `[${visualType}]`, classes: ["sa-var-type"] });

    let keyLabel = $e("span", leftSide, { innerText: key, classes: ["sa-var-name"] });
    if (dimKey) keyLabel.style.opacity = "0.4";

    let hasChildren = (value !== null && value.constructor.name === "Object") || value instanceof Array;

    let rightBit = $e("div", container, { classes: ["sa-var-right"] });
    let valueLabel = $e("span", rightBit, { innerText: hasChildren ? ">" : value, classes: ["sa-var-value"] });

    if (!hasChildren) {
        let lockButton = $e("span", rightBit, { innerText: " -", classes: ["sa-var-lock"] });
        lockButton.addEventListener("click", function(event) {
            event.stopPropagation();
            lockButton.classList.toggle("sa-locked");
            let isLocked = lockButton.classList.contains("sa-locked");
            lockButton.innerText = isLocked ? " X" : " -";

            if (isLocked) {
                lockedVariables[varPath] = cachedChanges.flatVars[varPath];
            } else {
                delete lockedVariables[varPath];
            }
        });
    }

    if (!hasChildren && type !== "?") {
        let knownWorking = value;

        // Ren'Py: Don't allow editing of advanced Python objects (yet)
        if (value === "<advanced>") {
            valueLabel.classList.add("sa-note");
        } else {
            valueLabel.setAttribute("contenteditable", "true");
        }

        // Ren'Py: Don't let <html> gobble up our events
        valueLabel.addEventListener("keypress", function (event) {
            event.stopPropagation();
        });

        valueLabel.addEventListener("keydown", function (event) {
            event.stopPropagation();
            valueLabel.classList.remove("sa-angry");
            if (event.key === "Enter") valueLabel.blur();
        });

        valueLabel.addEventListener("blur", function (event) {
            // Ren'Py: Don't set advanced objects to strings lol
            if (valueLabel.innerText === "<advanced>") return;

            try {
                let value = cast(valueLabel.innerText, type);
                setVariable(familyTree, value);
                knownWorking = value;
            } catch (err) {
                console.log(err)
                valueLabel.innerText = knownWorking;
                valueLabel.classList.add("sa-angry");
            }
        });

        container.addEventListener("click", function () {
            valueLabel.focus();
        });
    } else if (hasChildren) {
        // Special cases for array and object
        container.classList.add("sa-clickable")

        let dimChildKey = value instanceof Array;
        let childContainer = $e("div", parent, { classes: ["sa-var-folder", "sa-contracted"], "style.borderLeft": "1px solid", "style.borderColor": "blue" });
        let i = 0;
        for (const [key, item] of Object.entries(value)) {
            let cont = renderVariable(key, item, childContainer, i, familyTree, recursionLevel + 1, dimChildKey);
            cont.style.paddingLeft = `${recursionLevel + 1 * 12}px`;
            i++;
        }

        if (!childContainer.children.length) {
            $e("div", childContainer, { innerText: "empty", classes: ["sa-var-container", "sa-note"] })
        }

        container.addEventListener("click", function () {
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


/* Change Log */
async function variableChangeWatchdog() {
    let variables = await getVariables();
    let changes = findVariableChanges(variables);

    for (const [k, v] of Object.entries(changes)) {
        // Update existing variable visually
        let el = $el(`[var-path="${k}"] > .sa-var-value`);
        if (el) el.innerText = v;

        // Log change
        logVariableChange(k, v);
    }
}