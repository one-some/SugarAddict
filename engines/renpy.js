const Module = window.wrappedJSObject.Module;
const RenpyExec = window.wrappedJSObject.renpy_exec;
const RenpyGet = window.wrappedJSObject.renpy_get;

let history = [];
let historyPointer = 0;

const ExecMethods = {
    RENPY_EXEC: "RENPY_EXEC",
    PYRUN_SIMPLESTRING: "PYRUN_SIMPLESTRING",
};
let execMethod;

function consoleWrite(out) {
    /* Stub */
}
function log(...args) {
    console.log("[SA @ RenPy]", ...args);
}

// Hijack output function to process data
let outputListeners = [];
let errorListeners = [];

if (!window.wrappedJSObject.SA_OLDOUT) {
    exportFunction(window.wrappedJSObject.out.bind({}), window, {
        defineAs: "SA_OLDOUT",
    });
    exportFunction(window.wrappedJSObject.err.bind({}), window, {
        defineAs: "SA_OLDERR",
    });
    //exportFunction(window.wrappedJSObject.Module.print.bind({}), window, { defineAs: "SA_OLDOUT" });
    //exportFunction(window.wrappedJSObject.Module.printErr.bind({}), window, { defineAs: "SA_OLDERR" });
}

function noProp(event) {
    event.stopPropagation();
}

function isEngineOutputAnnoying(text) {
    let t = text.toLowerCase();

    for (const annoying in [
        "syncfs operations in flight at once",

        // Ignore exceptions from unwritable DBs due to what I assume is private mode
        "a mutation operation was attempted on",
    ]) {
        continue;
        if (t.includes(annoying.toLowerCase())) {
            console.log("ANNOYING!");
            return true;
        }
    }

    return false;
}

exportFunction(
    function (text) {
        if (isEngineOutputAnnoying(text)) return;

        // window.wrappedJSObject.SA_OLDOUT(text);
        console.log(text);
        for (const listener of outputListeners) {
            listener(text);
        }
    },
    window,
    { defineAs: "out" }
);

exportFunction(
    function (text) {
        if (isEngineOutputAnnoying(text)) return;

        window.wrappedJSObject.SA_OLDERR(text);
        for (const listener of errorListeners) {
            listener(text);
        }
    },
    window,
    { defineAs: "err" }
);

// Run in Python VM
function execRawPy(code) {
    if (execMethod === ExecMethods.RENPY_EXEC) {
        // newer versions of renpy expose this for FREE!!! (thank you Teyut!!!!)
        // also very new versions(?) don't support pyrunsimplestring directly
        setTimeout(async function () {
            await RenpyExec(code);
        }, 0);
    } else {
        // console.info("[SA @ _PyRun_SimpleString]", ret);
        let pointer = string2stack(code);
        let ret = Module._PyRun_SimpleString(pointer);
        // Ret is -1 for error, 0 for success
    }
}

function execPy(code) {
    if (code === "\\clear") {
        for (const el of document.querySelectorAll(".sa-log-entry")) {
            el.remove();
        }
        return;
    }

    // Lame workaround for non working passthrough stuff. builtins._ isn't set :^(
    if (code[0] === "\\") {
        code = code.slice(1);
        code = `print(${code})`;
    }
    execRawPy(code);
}

function string2stack(string) {
    // Adapted from reverse engineered function. Puts a string on the stack or something
    let ret = 0;
    if (!string) return;

    let size = (string.length << 2) + 1;
    let pointer = window.wrappedJSObject.stackAlloc(size);
    window.wrappedJSObject.stringToUTF8(string, pointer, size);

    // TODO: Free memory after allocating? Or is that GCed?

    return pointer;
}

function initPythonVM() {
    // Be careful; no f-strings here. Engine may be running on python2.
    if (execMethod === ExecMethods.RENPY_EXEC) {
        // Patch json to not error when trying to process advanced stuff
        execRawPy(
            `import functools;json.dumps=functools.partial(json.dumps, default=lambda x: "SA_ADV|"+x.__class__.__name__)`
        );
        // execRawPy(`import functools;json.dumps=functools.partial(json.dumps, default=str)`);
    } else {
        // Experimental optimizations
        execRawPy("import json");
        execRawPy("import renpy");

        execRawPy(`renpy.pri_store = renpy.python.store_dicts["store"]`);

        execRawPy(`
def SA_EXPORT(val):
    import json
    print("SA_EXP|" + json.dumps(val, default=lambda x: "<advanced>"))
renpy.exports.SA_EXPORT = SA_EXPORT`);
        execRawPy(`renpy.exports.notify("SugarAddict Injected :-)")`);
    }

    execRawPy(`print("""[SugarAddict] RenPy VM hijack success, have fun!
[SugarAddict] renpy.python.store_dicts["store"] is bound to renpy.pri_store for conveinence. Or... just use the variable editor.
[SugarAddict] Some renpy methods and variables you may be familiar with might be located in 'renpy.exports' instead of 'renpy'.
-----
""")`);
    /*
        execRawPy(`import renpy
    renpy.config.gc_thresholds = (10000, 10, 10)
    renpy.config.image_cache_size_mb = 100
    `);
    */
    // Default is (25000, 10, 10)
}

function execRawExpectOutput(code) {
    return new Promise(function (resolve, reject) {
        const listener = function (out) {
            if (!out.startsWith("SA_EXP|")) {
                return;
            }

            out = out.replace("SA_EXP|", "");

            // Remove self from listeners, we're done
            outputListeners = outputListeners.filter(function (l) {
                return l !== listener;
            });

            resolve(out);
        };

        outputListeners.push(listener);
        execRawPy(code);
    });
}

async function getRenpyVars() {
    if (execMethod === ExecMethods.RENPY_EXEC) {
        return await RenpyGet("{k: v for k, v in renpy.python.store_dicts['store'].items() if not isinstance(v, type) and not callable(v)}");
        // return await RenpyGet("{k: renpy.python.store_dicts['store'][k] for k in renpy.python.store_dicts['store'].ever_been_changed if k in renpy.python.store_dicts['store']}");
        // return await RenpyGet("{k: renpy.python.store_dicts['store'][k] for k in renpy.python.store_dicts['store'].ever_been_changed if k in renpy.python.store_dicts['store']}");
    } else {
        //let out = await execRawExpectOutput(`renpy.exports.SA_EXPORT({k: renpy.pri_store[k] for k in renpy.pri_store.ever_been_changed if k in renpy.pri_store})`);
        //return JSON.parse(out);
        return [];
    }
}

async function getSingleVariable(keyChain) {
    let out = await RenpyExec(`
base = renpy.python.store_dicts["store"]
j_dat = base64.b64decode("${btoa(JSON.stringify(keyChain))}").decode("utf-8")
for part in json.loads(j_dat):
    if hasattr(base, "__getitem__"):
        base = base[part]
    else:
        base = getattr(base, part)
result = base`);
    return out;
}

async function getRenpyLabels() {
    if (execMethod === ExecMethods.RENPY_EXEC) {
        return await RenpyGet("list(renpy.get_all_labels())");
    } else {
        return JSON.parse(
            await execRawExpectOutput(
                "renpy.exports.SA_EXPORT(list(renpy.exports.get_all_labels()))"
            )
        );
    }
}

async function getPyObjDetails(path) {
    const pathParts = path.split(".");
    const headName = pathParts.shift();
    const bodyIndexChain = pathParts.length ? "." + pathParts.join(".") : "";

    // let childrenValues = await RenpyGet(
    //     `{k: getattr(renpy.python.store_dicts["store"]["${headName}"]${bodyIndexChain}, k) ` +
    //     `for k in dir(renpy.python.store_dicts["store"]["${headName}"]${bodyIndexChain}) ` +
    //     `if not (k.startswith("__") and k.endswith("__"))}`
    // );
    let childrenKeys = await RenpyGet(
        `[k for k in dir(renpy.python.store_dicts["store"]["${headName}"]${bodyIndexChain}) ` +
        `if not (k.startswith("__") and k.endswith("__"))]`
    );

    return {
        children: childrenKeys,
    };
}

export async function initRenPyWeb() {
    log("Initializing Ren'PyWeb backend...");
    execMethod = RenpyExec
        ? ExecMethods.RENPY_EXEC
        : ExecMethods.PYRUN_SIMPLESTRING;
    log(`Found execmethod ${execMethod}`);

    const { $e, $el } = await import(browser.runtime.getURL("ui/util.js"));

    const { makeWindow } = await import(browser.runtime.getURL("ui/window.js"));
    const tabs = await makeWindow({
        home: { title: "Home", icon: "🏠" },
        vars: { title: "Variables", icon: "🔧" },
        varlog: { title: "State Log", icon: "🔴" },
        labels: { title: "Labels", icon: "📔" },
        console: { title: "Console", icon: "🤹" },
    });

    /* Home */
    $e("span", tabs.home.content, { innerText: "Info", classes: ["sa-header"] });

    if (execMethod === ExecMethods.RENPY_EXEC) {
        $e("span", tabs.home.content, {
            innerText:
                "Exec Method: renpy_exec\nNewer RenPy version; Old injection method won't work. Possible instability lies ahead.",
            classes: ["sa-header"],
            "style.color": "gold",
        });
    } else if (execMethod === ExecMethods.PYRUN_SIMPLESTRING) {
        $e("span", tabs.home.content, {
            innerText: "Exec Method: PyRun_SimpleString",
            classes: ["sa-header"],
            "style.color": "green",
        });
    } else {
        alert("What");
    }

    $e("span", tabs.home.content, {
        innerText: "Memory Management",
        classes: ["sa-header"],
    });
    const gcButton = $e("div", tabs.home.content, {
        innerText: "Force GC",
        classes: ["sa-nav-button"],
    });
    gcButton.addEventListener("click", function () {
        console.info("[SA @ RenPy] Trying GC collect");
        execPy("renpy.memory.gc.collect()");
    });

    const freeMemButton = $e("div", tabs.home.content, {
        innerText: "Try free_memory (May crash, save first!)",
        classes: ["sa-nav-button"],
    });
    freeMemButton.addEventListener("click", function () {
        execPy("renpy.exports.free_memory()");
    });

    const enableFastSkipping = $e("div", tabs.home.content, {
        innerText: "Enable fast skipping (>)",
        classes: ["sa-nav-button"],
    });
    enableFastSkipping.addEventListener("click", function () {
        execPy("renpy.config.fast_skipping = True");
    });

    const markAllSeen = $e("div", tabs.home.content, {
        innerText: "Mark all labels visited (Unlocks some path progression checks)",
        classes: ["sa-nav-button"],
    });
    markAllSeen.addEventListener("click", function () {
        execPy(`
for label in renpy.exports.get_all_labels():
    renpy.game.persistent._seen_ever[label] = True
`);
    });

    const markAllUnseen = $e("div", tabs.home.content, {
        innerText: "Mark all labels unvisited",
        classes: ["sa-nav-button"],
    });
    markAllUnseen.addEventListener("click", function () {
        execPy("renpy.game.persistent._seen_ever = {}");
    });

    /* Console */
    const consoleOutputEl = $e("div", tabs.console.content, {
        id: "sa-rp-console-output",
    });
    function consoleWrite(out, error = false) {
        // Don't leak channeled data into console
        if (out.startsWith("SA_EXP|")) return;

        const line = $e("div", consoleOutputEl, {
            innerText: out,
            classes: ["sa-log-entry"],
        });
        if (error) line.classList.add("sa-log-error");
        line.scrollIntoView();
    }
    outputListeners.push((t) => consoleWrite(t));
    errorListeners.push(function (t) {
        // SPAMMY!!
        if (t.includes("libpng")) return;
        consoleWrite(t, true);
    });
    initPythonVM();

    const pyInput = $e("input", tabs.console.content);
    pyInput.addEventListener("keydown", function (event) {
        event.stopPropagation();

        if (["ArrowUp", "ArrowDown"].includes(event.key)) {
            // History manipulation
            let delta = event.key === "ArrowUp" ? 1 : -1;

            // First empty history entry
            let h = [""].concat(history);
            if (h[historyPointer + delta] === undefined) return;
            historyPointer += delta;
            pyInput.value = h[historyPointer];

            // Select end
            // https://stackoverflow.com/a/3357143
            if (typeof pyInput.selectionStart == "number") {
                pyInput.selectionStart = pyInput.selectionEnd = pyInput.value.length;
            } else if (typeof pyInput.createTextRange != "undefined") {
                pyInput.focus();
                let range = pyInput.createTextRange();
                range.collapse(false);
                range.select();
            }
        }

        if (event.key !== "Enter") return;
        event.preventDefault();

        let command = pyInput.value;
        consoleWrite(">>> " + command);
        execPy(command);

        historyPointer = 0;
        history.unshift(command);

        pyInput.value = "";
    });

    pyInput.addEventListener("keypress", function (event) {
        // Yeah lets just swallow all events ever because that would be funny
        event.stopPropagation();
    });

    /* Variables */

    const { varEditorInit } = await import(
        browser.runtime.getURL("ui/variable_editor.js")
    );

    function setVariable(keyChain, v) {
        log("Setting", keyChain, v);
        let enc = JSON.stringify(v);

        // TODO: Support numbered index for list (this casts it to string like a dict)
        let indexChain = keyChain.map((key) => `["${key}"]`).join();

        if (execMethod === ExecMethods.RENPY_EXEC) {
            // b64 idea stolen from renpy bootloader shell thing
            execRawPy(
                `renpy.python.store_dicts["store"]${indexChain} = json.loads(base64.b64decode("${btoa(
                    enc
                )}").decode("utf-8"))`
            tabs.varlog.content.firstChild.remove();
        }
        const container = $e(
            "div",
            tabs.varlog.content,
            { classes: ["sa-varlog-cont"] },
            { before: tabs.varlog.content.firstChild }
        );
        const keyEl = $e("div", container, { innerText: k });
        const valueEl = $e("div", container, { innerText: v });
    }
    "div",
    const varContainer = $e("div", tabs.vars.content, { id: "sa-var-cont" });
    const varSearchBar = $e("input", tabs.vars.content);
    { before: tabs.varlog.content.firstChild; }
    varSearchBar.addEventListener("keydown", noProp);
    varSearchBar.addEventListener("keypress", noProp);
    const valueEl = $e("div", container, { innerText: v });
    await varEditorInit(
        {
            setVariable: setVariable,
            getVariables: getRenpyVars,
            getSingleVariable: getSingleVariable,
            logVariableChange: logVariableChange,
            getPythonObjectDetails: getPyObjDetails
        },
        { bar: varSearchBar, container: varContainer },
        500
    );
    getVariables: getRenpyVars,
        let vars = await getRenpyVars();
    logVariableChange: logVariableChange,
        /* Labels */
        $e("p", tabs.labels.content, {
            innerText:
                "Labels are one way in which Ren'Py handles control flow. They are similar to Twine/SugarCube's passages in a way.\n" +
                "Warning: Jumping to labels arbitrarily will likely result in errors after the label is finished or maybe even immediately. Be sure to save!",
        });
    let vars = await getRenpyVars();
    const labelContainer = $e("div", tabs.labels.content, {
        id: "sa-passage-container",
    });
    const labelSearchBar = $e("input", tabs.labels.content);
    "Labels are one way in which Ren'Py handles control flow. They are similar to Twine/SugarCube's passages in a way.\n" +
    const labels = await getRenpyLabels();
    log("Labels:", labels);

    for (const labelName of labels) {
        let labelEl = $e("div", labelContainer, { classes: ["sa-passage"] });
        $e("span", labelEl, { innerText: labelName, classes: ["sa-passage-name"] });
        let jumpButton = $e("span", labelEl, {
            innerText: "Jump",
            classes: ["sa-clickable"],
        });

        jumpButton.addEventListener("click", function () {
            //execRawPy(`renpy.exports.call_in_new_context("${labelName}")`)
            execRawPy(`renpy.exports.jump("${labelName}")`);
        });
    }
    classes: ["sa-clickable"],
        function processForSearch(string) {
            string = string.toLowerCase();
            string = string.replaceAll(/\s/g, "");
            return string;
        };
});
// Ren'Py <html> gobbles events!!
labelSearchBar.addEventListener("keydown", noProp);
labelSearchBar.addEventListener("keypress", noProp);
string = string.toLowerCase();
labelSearchBar.addEventListener("input", function () {
    let query = processForSearch(labelSearchBar.value);
    for (const labelEl of document.getElementsByClassName("sa-passage")) {
        let name = labelEl.querySelector(".sa-passage-name").innerText;
        if (!query || processForSearch(name).includes(query)) {
            labelEl.classList.remove("sa-hidden");
        } else {
            labelEl.classList.add("sa-hidden");
        }
    }
    updateLabelVisualPolarity();
});
if (!query || processForSearch(name).includes(query)) {
    function updateLabelVisualPolarity() {
        // This really sucks but there aren't a lot of better solutions. :(
        for (const [i, passageContainer] of Object.entries(
            document.querySelectorAll(".sa-passage:not(.sa-hidden)")
        )) {
            if (i % 2 === 0) {
                passageContainer.classList.add("sa-shiny");
            } else {
                passageContainer.classList.remove("sa-shiny");
            }
        }
    }
    updateLabelVisualPolarity();
    if (i % 2 === 0) {
        passageContainer.classList.add("sa-shiny");
    } else {
        passageContainer.classList.remove("sa-shiny");
    }
}
  }
updateLabelVisualPolarity();
}

/* TODO:
 *         enableSkipping:  function() {
            LDS.RenPy.runPython(`
import renpy.config
renpy.config.allow_skipping = True`);
            },
*/
