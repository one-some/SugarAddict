let cachedChanges = {};
let lockedVariables = {};
let renderedVariables = [];
let searchElements = {};
let monitoringInterval;

const varPathToElTable = {};

let srcCallbacks = {
    setVariable: undefined,
    getVariables: undefined,
    logVariableChange: undefined,
    getPythonObjectDetails: undefined,
    getSingleVariable: undefined,
};

function log(...args) {
    console.log("[SA @ VariableEditor]", ...args);
}

function varPathToEl(path) {
    // Cache for speeeeed
    return varPathToElTable[path];
}

function recursivelyMakeChildrenVisible(varPath) {
    for (const [path, container] of Object.entries(varPathToElTable)) {
        if (!path.startsWith(varPath + ".")) continue;
        container.classList.remove("sa-hidden");
    }
}

async function varEditorInit(
    sourceCallbacks,
    _searchElements,
    varCheckInterval
) {
    for (const key in srcCallbacks) {
        srcCallbacks[key] = sourceCallbacks[key];
    }
    searchElements = _searchElements;

    searchElements.bar.addEventListener("input", function () {
        let query = processForSearch(searchElements.bar.value);
        let baseMatchPaths = [];

        for (const varContainer of document.getElementsByClassName("sa-var-container")) {
            // If no query, show everything
            if (!query) {
                // TODO: Respect folded
                varContainer.classList.remove("sa-hidden");
                continue;
            }

            if (
                !varContainer.saVarKey
                || !varContainer.saVarValue
            ) {
                varContainer.classList.add("sa-hidden");
                continue;
            }


            const name = processForSearch(varContainer.saVarKey);

            const value = processForSearch(
                varContainer.saVarValue.toString(),
            );

            const matching = name.includes(query) || value.includes(query);
            const varPath = varContainer.getAttribute("var-path");

            if (matching) {
                baseMatchPaths.push(varPath);
                varContainer.classList.remove("sa-hidden");

                // Walk up the tree and reveal parents
                let pathBits = [];

                for (const pathBit of varPath.split(".")) {
                    pathBits.push(pathBit);
                    let elVar = varPathToEl(pathBits.join('.'));
                    elVar.classList.remove("sa-hidden");
                }
            } else {
                varContainer.classList.add("sa-hidden");
            }
        }

        for (const match of baseMatchPaths) {
            recursivelyMakeChildrenVisible(match);
        }
    });

    // let i = 0;
    // for (const [key, value] of Object.entries(await srcCallbacks.getVariables())) {
    //     renderVariable(key, value, searchElements.container, i);
    //     renderedVariables.push(key);
    //     i++;
    // }

    monitoringInterval = setInterval(variableChangeWatchdog, varCheckInterval);
}

function processForSearch(string) {
    if (!string) return "";
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

        console.log("LUP");
        console.log("LOCKEDUPDATE", varPath, lockValue);
        srcCallbacks.setVariable(varPath.split("."), lockValue);
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
    let v = 28 + recursionLevel * 10;
    if (index % 2 === 0) v += 3;
    return `rgb(${[v, v, v].join(",")})`;
}

async function getVarData(value, varPath) {
    let type = "unk";

    let pyObjData;
    if (
        typeof value === "string"
        && srcCallbacks.getPythonObjectDetails
        && value.startsWith("SA_ADV|")
    ) {
        const pyClass = value.split("|", 2)[1];
        if ([
            "builtin_function_or_method",
            "instancemethod"
        ].includes(pyClass)) {
            // For methods or randomly dangling functions
            type = "function";
        } else {
            // Advanced
            pyObjData = await srcCallbacks.getPythonObjectDetails(varPath);
            pyObjData.class = pyClass;
        }
    }

    if (type !== "unk") {
        // pass
    } else if (pyObjData) {
        type = "pyobject";
    } else if (value === null) {
        type = "null";
    } else if (typeof value === "boolean") {
        type = "boolean";
    } else if (typeof value === "number") {
        type = "number";
    } else if (typeof value === "string") {
        type = "string";
    } else if (Array.isArray(value)) {
        type = "array";
    } else if (typeof value === "object") {
        type = "object";
    }

    return [pyObjData, type];
}

function getVisualType(type) {
    return {
        null: "0",
        boolean: "b",
        number: "#",
        string: "s",
        array: "a",
        object: "o",
        pyobject: "c",
        function: "f",
    }[type] || "?";
}

function getValueAppearance(value, type) {
    return {
        array: ">",
        object: "}",
        pyobject: "~",
        function: "f()",
    }[type] || value;
}

async function retypeElement(el, value) {
    const varPath = el.getAttribute("var-path");
    let [pyObjData, type] = await getVarData(value, varPath);

    if (type === el.getAttribute("sa-type")) {
        console.log("LOL IGNORE!");
        return;
    }
    console.log("Something interesting....", el);

    let visualType = getVisualType(type);
    let valueAppearance = getValueAppearance(value, type);

    el.setAttribute("sa-type", type);

    el.querySelector(".sa-type-label").innerText = `[${visualType}] `;
    el.querySelector(".sa-value").innerText = valueAppearance;
}

function cast(value, type) {
    if (type === "null") return value; // ¯\_(ツ)_/¯
    if (type === "string") return value.toString();
    if (type === "boolean") {
        const caster = { true: true, false: false };
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

async function renderVariable(
    key,
    value,
    parent,
    index,
    familyTree = null,
    recursionLevel = 0,
    dimKey = false
) {
    familyTree = [...(familyTree || []), key];
    let varPath = familyTree.join(".");

    if (!key) {
        console.warn("No key!");
        return;
    }


    let container = $e("div", parent, {
        classes: ["sa-var-container"],
        "var-path": varPath,
    });

    // Cache these here for speedup
    container.saVarKey = key;
    container.saVarValue = value;
    
    varPathToElTable[varPath] = container;

    if (recursionLevel === 0) container.classList.add("sa-toplevel-var");

    container.style.backgroundColor = getRecursionCSSColor(recursionLevel, index);

    if (value === undefined) value = null;
    let [pyObjData, type] = await getVarData(value, varPath);
    let visualType = getVisualType(type);

    let leftSide = $e("div", container);
    container.setAttribute("sa-type", type);

    //let typeClass = `sa-type-${type === "?" ? "unk" : type}`;

    let typeLabel = $e("span", leftSide, {
        innerText: `[${visualType}]`,
        classes: ["sa-typed", "sa-type-label"]//, typeClass],
    });

    let keyLabel = $e("span", leftSide, {
        innerText: key,
        classes: ["sa-var-name"],
    });
    if (dimKey) keyLabel.style.opacity = "0.4";

    let valueAppearance = getValueAppearance(value, type);

    const rightBit = $e("div", container, { classes: ["sa-var-right"] });
    const valueLabel = $e("span", rightBit, {
        innerText: valueAppearance,
        classes: ["sa-typed", "sa-value"],
    });

    const hasChildren = ["object", "array", "pyobject"].includes(type);
    const valueEditable = !["?", "function"].includes(type);

    if (!hasChildren && valueEditable) {
        let lockButton = $e("span", rightBit, {
            innerText: " -",
            classes: ["sa-var-lock"],
        });
        lockButton.addEventListener("click", function (event) {
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


        let knownWorking = value;
        valueLabel.setAttribute("contenteditable", "true");

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
            try {
                let value = cast(valueLabel.innerText, container.getAttribute("sa-type"));
                srcCallbacks.setVariable(familyTree, value);
                knownWorking = value;
            } catch (err) {
                console.log(err);
                valueLabel.innerText = knownWorking;
                valueLabel.classList.add("sa-angry");
            }
        });

        container.addEventListener("click", function () {
            valueLabel.focus();
        });
    } else if (hasChildren) {
        // Special cases for array and object
        container.classList.add("sa-clickable");

        let dimChildKey = type === "array";
        let childContainer = $e("div", parent, {
            classes: ["sa-var-folder", "sa-contracted"],
            "style.borderLeft": "1px solid",
            "style.borderColor": "blue",
        });
        let i = 0;
        if (!pyObjData) {
            for (const [key, item] of Object.entries(value)) {
                let cont = await renderVariable(
                    key,
                    item,
                    childContainer,
                    i,
                    familyTree,
                    recursionLevel + 1,
                    dimChildKey
                );
                if (!cont) return;
                cont.style.paddingLeft = `${recursionLevel + 1 * 12}px`;
                i++;
            }
        } else {
            for (const key of pyObjData.children) {
                const item = await srcCallbacks.getSingleVariable([...familyTree, key]);
                let cont = await renderVariable(
                    key,
                    item,
                    childContainer,
                    i,
                    familyTree,
                    recursionLevel + 1,
                    dimChildKey
                );
                cont.style.paddingLeft = `${recursionLevel + 1 * 12}px`;
                i++;
            }
        }

        if (!childContainer.children.length) {
            $e("div", childContainer, {
                innerText: "empty",
                classes: ["sa-var-container", "sa-note"],
            });
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
let watchdogLocked = false;
async function variableChangeWatchdog() {
    if (watchdogLocked) return;
    watchdogLocked = true;

    let variables = await srcCallbacks.getVariables();

    // Render new variables
    let i = renderedVariables.length - 1;
    for (const [key, value] of Object.entries(variables)) {
        if (renderedVariables.includes(key)) continue;

        // log(`Found new variable '${key}'`);
        await renderVariable(key, value, searchElements.container, i);
        renderedVariables.push(key);
        i++;
    }

    let changes = findVariableChanges(variables);
    for (const [k, v] of Object.entries(changes)) {
        // Update existing variable visually
        let rowEl = varPathToEl(k);
        // TODO: What's up with this?
        if (!rowEl) continue;

        await retypeElement(rowEl, v);

        let el = rowEl.querySelector(".sa-var-value");
        if (el) el.innerText = v;
        if (rowEl) {
            rowEl.classList.remove("sa-highlight-var");
            rowEl.classList.add("sa-highlight-var");

            setTimeout(function () {
                rowEl.classList.remove("sa-highlight-var");
            }, 500);
        }

        // Log change
        // console.log(k, " => ", v)
        srcCallbacks.logVariableChange(k, v);
    }

    watchdogLocked = false;
}
