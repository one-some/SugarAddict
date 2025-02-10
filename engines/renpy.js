//\[renpy.mark_image_seen(x) for x in renpy.list_images()]

const Module = window.wrappedJSObject.Module;
let RenpyExec = window.wrappedJSObject.renpy_exec;
let RenpyGet = window.wrappedJSObject.renpy_get;

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
    setTimeout(async function () {
        await RenpyExec(code);
    }, 0);
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
        execRawPy("renpy.get_all_labels = renpy.exports.get_all_labels");
    }

    // Patch json to not error when trying to process advanced stuff
    execRawPy(`import functools;json.dumps=functools.partial(json.dumps, default=lambda x: "SA_ADV|"+x.__class__.__name__)`);

    execRawPy(`print("""[SugarAddict] RenPy VM hijack success, have fun!
[SugarAddict] renpy.python.store_dicts["store"] is bound to renpy.pri_store for conveinence. Or... just use the variable editor.
[SugarAddict] Some renpy methods and variables you may be familiar with might be located in 'renpy.exports' instead of 'renpy'.
-----
""")`);
}

async function getRenpyVars() {
    return await RenpyGet("{k: renpy.python.store_dicts['store'][k] for k in renpy.python.store_dicts['store'].ever_been_changed if k in renpy.python.store_dicts['store']}");
}

async function getSingleVariable(keyChain) {
    let nChain = [];
    for (const k of keyChain) {
        if (isNaN(k)) {
            nChain.push(k);
        } else {
            nChain.push(Number(k));
        }
    }

    let out = await RenpyExec(`
base = renpy.python.store_dicts["store"]
j_dat = base64.b64decode("${btoa(JSON.stringify(nChain))}").decode("utf-8")
for part in json.loads(j_dat):
    if hasattr(base, "__getitem__"):
        base = base[part]
    else:
        base = getattr(base, part)
result = base`);
    return out;
}

async function getRenpyLabels() {
    return await RenpyGet("list(renpy.get_all_labels())");
}

async function getPyObjDetails(path) {
    return {children: []};
    const pathParts = path.split(".");
    const headName = pathParts.shift();
    log("PATH", path);
    let bodyIndexChain = "";
    if (pathParts.length) {
        for (const part of pathParts) {
            // Starts with alphanumeric
            if (part[0].match(/[a-z]/i)) {
                bodyIndexChain += "." + part;
            } else {
                bodyIndexChain += `[${part}]`;
            }
        }
    }
    // const bodyIndexChain = pathParts.length ? "." + pathParts.join(".") : "";
    log(bodyIndexChain);

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

function bootstrapExec() {
    // Copyright 2022 Teyut <teyut@free.fr>, MIT License.
    let cmd_queue = [];
    let cur_cmd = undefined;

    /** This functions is called by the wrapper script at the end of script execution. */
    function cmd_callback(result) {
        // console.log("out", result);

        if (cur_cmd === undefined) {
            console.error('Unexpected command result', result);
            return;
        }

        try {
            if (result.error !== undefined) {
                const e = new Error(result.error);

                // Red!
                for (const listener of errorListeners) {
                    listener(result.error);
                }

                e.name = result.name;
                e.traceback = result.traceback;
                cur_cmd.reject(e);
            } else {
                cur_cmd.resolve(result.data);
            }
        } finally {
            cur_cmd = undefined;
            send_next_cmd();
        }
    }

    /** Prepare and send the next command to be executed if any. */
    function send_next_cmd() {
        if (cmd_queue.length == 0) return;

        cur_cmd = cmd_queue.shift();

        // Convert script to base64 to prevent having to escape
        // the script content as a Python string
        const script_b64 = btoa(cur_cmd.py_script);
        const wrapper = 'import base64, emscripten, json, traceback;\n'
            + 'try:'
            + "result = None;"
            + "exec(base64.b64decode('" + script_b64 + "').decode('utf-8'));"
            + "result = json.dumps(dict(data=result));"
            + "\n"
            + "except Exception as e:"
            + "result = json.dumps(dict(error=str(e), name=e.__class__.__name__, traceback=traceback.format_exc()));"
            + "\n"
            + "emscripten.run_script('_renpy_cmd_callback(%s)' % (result,));";


        let pointer = string2stack(wrapper);
        let ret = Module._PyRun_SimpleString(pointer);
    }

    /** Add a command to the queue and execute it if the queue was empty. */
    function add_cmd(py_script, resolve, reject) {
        const cmd = { py_script: py_script, resolve: resolve, reject: reject };
        cmd_queue.push(cmd);

        if (cur_cmd === undefined) send_next_cmd();
    }

    RenpyExec = function (py_script) {
        // console.log("RUN", py_script);
        return new Promise((resolve, reject) => {
            add_cmd(py_script, resolve, reject);
        });
    };

    RenpyGet = function (name) {
        return new Promise((resolve, reject) => {
            RenpyExec('result = ' + name)
                .then(resolve).catch(reject);
        });
    };

    // Unused for now
    let renpy_set = function (name, value, raw) {
        let script;
        if (raw) {
            script = name + " = " + value + "; result = True";
        } else {
            // Using base64 as it is unclear if we can use the output
            // of JSON.stringify() directly as a Python string
            script = 'import base64, json; '
                + name + " = json.loads(base64.b64decode('"
                + btoa(JSON.stringify(value))
                + "').decode('utf-8')); result = True";
        }
        return new Promise((resolve, reject) => {
            RenpyExec(script)
                .then(resolve).catch(reject);
        });
    };

    exportFunction(cmd_callback, window, { defineAs: "_renpy_cmd_callback" });
}

export async function initRenPyWeb() {
    log("Initializing Ren'PyWeb backend...");
    execMethod = RenpyExec
        ? ExecMethods.RENPY_EXEC
        : ExecMethods.PYRUN_SIMPLESTRING;
    log(`Found execmethod ${execMethod}`);

    if (execMethod === ExecMethods.PYRUN_SIMPLESTRING) {
        log("PYRUN_SIMPLESTRING: Bootstrapping exec functions");
        bootstrapExec();
    }

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
                "Exec Method: renpy_exec\nNewer RenPy version; using native exec hooks.",
            classes: ["sa-header"],
            "style.color": "green",
        });
    } else if (execMethod === ExecMethods.PYRUN_SIMPLESTRING) {
        $e("span", tabs.home.content, {
            innerText: "Exec Method: PyRun_SimpleString. Older RenPy version; sketchy exec hax",
            classes: ["sa-header"],
            "style.color": "gold",
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
        execPy("[renpy.mark_image_seen(x) for x in renpy.list_images()]");

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

    function setVariable(keyChain, v) {
        log("Setting", keyChain, v);
        let enc = JSON.stringify(v);

        // TODO: Support numbered index for list (this casts it to string like a dict)
        let indexChain = keyChain.map((key) => `["${key}"]`).join();

        execRawPy(`renpy.python.store_dicts["store"]${indexChain} = json.loads(base64.b64decode("${btoa(enc)}").decode("utf-8"))`);
    }

    function logVariableChange(k, v) {
        while (tabs.varlog.content.children.length >= 30) {
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

    const varContainer = $e("div", tabs.vars.content, { id: "sa-var-cont" });
    const varSearchBar = $e("input", tabs.vars.content);
    varSearchBar.addEventListener("keydown", noProp);
    varSearchBar.addEventListener("keypress", noProp);

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

    let vars = await getRenpyVars();

    /* Labels */
    $e("p", tabs.labels.content, {
        innerText:
            "Labels are one way in which Ren'Py handles control flow. They are similar to Twine/SugarCube's passages in a way.\n" +
            "Warning: Jumping to labels arbitrarily will likely result in errors after the label is finished or maybe even immediately. Be sure to save!",
    });

    const labelContainer = $e("div", tabs.labels.content, {
        id: "sa-passage-container",
    });
    const labelSearchBar = $e("input", tabs.labels.content);
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

    // Ren'Py <html> gobbles events!!
    labelSearchBar.addEventListener("keydown", noProp);
    labelSearchBar.addEventListener("keypress", noProp);

    labelSearchBar.addEventListener("input", function () {
        let query = processForSearch(labelSearchBar.value);
        for (const labelEl of document.getElementsByClassName("sa-passage")) {
            let name = labelEl.querySelector(".sa-passage-name").innerText;
            if (!query || processForSearch(name).includes(query)) {
                labelEl.classList.remove("sa-hidden");
            } else {
                labelEl.classList.add("sa-hidden");
            }
            updateLabelVisualPolarity();
        }

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

        if (i % 2 === 0) {
            passageContainer.classList.add("sa-shiny");
        } else {
            passageContainer.classList.remove("sa-shiny");
        }
        updateLabelVisualPolarity();
    });
}

function processForSearch(string) {
    string = string.toLowerCase();
    string = string.replaceAll(/\s/g, "");
    return string;
}


/* TODO:
 *         enableSkipping:  function() {
            LDS.RenPy.runPython(`
import renpy.config
renpy.config.allow_skipping = True`);
            },
*/
