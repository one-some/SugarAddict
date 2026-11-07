//\[renpy.mark_image_seen(x) for x in renpy.list_images()]

const Module = window.wrappedJSObject.Module;

let RenpyExec;
let RenpyGet;
let history = [];
let historyPointer = 0;

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

exportFunction(
    function (text) {
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
        await RenpyExec(code).catch(e => console.error(code, e));
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
    execRawPy("import json");
    execRawPy("import renpy");
    execRawPy("renpy.get_all_labels = renpy.exports.get_all_labels");

    // Patch json to not error when trying to process advanced stuff
    execRawPy(`
try:
    import builtins as _b
except ImportError:
    import __builtin__ as _b
def _sa_short_repr(o, limit=200, _b=_b):
    try:
        r = _b.repr(o)
    except Exception as e:
        return "<repr error: " + _b.str(e) + ">"
    if _b.len(r) > limit:
        r = r[:limit] + "..."
    return r
def _sa_safe_len(o, _b=_b):
    try:
        return _b.len(o)
    except Exception:
        return None
def _sa_dump_impl(obj, max_depth=2, _b=_b):
    refs = renpy.python.store_dicts["store"].setdefault("_sa_refs", {})
    if _b.len(refs) > 500:
        for k in _b.list(refs.keys())[:250]:
            refs.pop(k, None)
    seen = _b.set()
    def _looks_like_mapping(o):
        return (_b.hasattr(o, "items") and _b.hasattr(o, "keys") and _b.hasattr(o, "__getitem__") and not _b.isinstance(o, _b.str))
    def _looks_like_sequence(o):
        return (_b.hasattr(o, "__iter__") and _b.hasattr(o, "__len__") and not _b.isinstance(o, (_b.str, _b.bytes)) and not _looks_like_mapping(o))
    def walk(o, depth):
        if o is None or _b.isinstance(o, _b.bool) or _b.isinstance(o, (_b.int, _b.float, _b.str)):
            return o
        oid = _b.id(o)
        if oid in seen:
            return {"__sa__": "cycle", "type": _b.type(o).__name__}
        seen.add(oid)
        if depth >= max_depth:
            refs[oid] = o
            return {"__sa__": "deep", "type": _b.type(o).__name__, "repr": renpy.sa_short_repr(o), "id": oid, "len": _sa_safe_len(o)}
        if _looks_like_mapping(o):
            try:
                return {(_b.str(k) if not _b.isinstance(k, _b.str) else k): walk(v, depth + 1) for k, v in o.items()}
            except Exception:
                pass
        if _b.isinstance(o, _b.tuple):
            return {"__sa__": "tuple", "items": [walk(v, depth + 1) for v in o]}
        if _b.isinstance(o, (_b.set, _b.frozenset)):
            return {"__sa__": "set", "items": [walk(v, depth + 1) for v in o]}
        if _b.isinstance(o, _b.bytes):
            return {"__sa__": "bytes", "len": _b.len(o), "preview": o[:64].decode("latin-1", "replace")}
        if _looks_like_sequence(o):
            try:
                return [walk(v, depth + 1) for v in o]
            except Exception:
                pass
        refs[oid] = o
        fields = []
        try:
            fields = [k for k in _b.dir(o) if not k.startswith("_")][:50]
        except Exception:
            pass
        return {"__sa__": "opaque", "type": _b.type(o).__name__, "module": _b.getattr(_b.type(o), "__module__", "?"), "repr": renpy.sa_short_repr(o), "id": oid, "fields": fields}
    return walk(obj, 0)
renpy.sa_short_repr = _sa_short_repr
renpy.sa_safe_len = _sa_safe_len
renpy.sa_dump = _sa_dump_impl
`);

    execRawPy(`print("""[SugarAddict] RenPy VM hijack success, have fun!
[SugarAddict] renpy.python.store_dicts["store"] is bound to renpy.pri_store for conveinence. Or... just use the variable editor.
[SugarAddict] Some renpy methods and variables you may be familiar with might be located in 'renpy.exports' instead of 'renpy'.
-----
""")`);
}

async function getRenpyVars() {
    return await RenpyExec(`
_store = renpy.python.store_dicts["store"]
_changed = {
    k: _store[k] for k in _store.ever_been_changed
    if k in _store and not k.startswith("_")
}
result = renpy.sa_dump(_changed, max_depth=2)
`);
}

async function getSingleVariable(keyChain) {
    const path_b64 = btoa(JSON.stringify(keyChain));
    return await RenpyExec(`
import base64, json
_path = json.loads(base64.b64decode("${path_b64}").decode("utf-8"))
_base = renpy.python.store_dicts["store"]
for _part in _path:
    try:
        _base = _base[_part]
    except (KeyError, TypeError, IndexError):
        _base = getattr(_base, _part)
result = renpy.sa_dump(_base, max_depth=2)
`);
}

async function getRenpyLabels() {
    return await RenpyGet("result = sorted(L for L in renpy.get_all_labels() if not L.startswith('_'))");
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
    log(bodyIndexChain);

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
                console.error("ouch!!", result.name, result.error, result.traceback);
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
            + 'try:\n'
            + " result = None\n"
            + " exec(base64.b64decode('" + script_b64 + "').decode('utf-8'))\n"
            + " try:\n"
            + "  _payload = json.dumps(dict(data=result))\n"
            + " except TypeError:\n"
            + "  _payload = json.dumps(dict(data=renpy.sa_dump(result)))\n"
            + "except Exception as e:\n"
            + " _payload = json.dumps(dict(error=str(e), name=e.__class__.__name__, traceback=traceback.format_exc()))\n"
            + "emscripten.run_script('_renpy_cmd_callback(%s)' % (_payload,))";

        if (Module._PyRun_SimpleString) {
            const saved = window.wrappedJSObject.stackSave();
            try {
                const  pointer = string2stack(wrapper);
                Module._PyRun_SimpleString(pointer);
            } finally {
                window.wrappedJSObject.stackRestore(saved);
            }
        } else {
            window.wrappedJSObject._renpy_cmd = wrapper;
        }
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

    bootstrapExec();

    const tabs = await makeWindow({
        home: { title: "Home", icon: "🏠" },
        vars: { title: "Variables", icon: "🔧" },
        varlog: { title: "State Log", icon: "🔴" },
        labels: { title: "Labels", icon: "📔" },
        console: { title: "Console", icon: "🤹" },
    });

    /* Home */
    $e("span", tabs.home.content, { innerText: "Info", classes: ["sa-header"] });

    $e("span", tabs.home.content, {
        innerText:
            "Exec Method: own rp_exec",
        classes: ["sa-header"],
        "style.color": "green",
    });

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

    const pyInput = $e("textarea", tabs.console.content);
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

        if (event.key !== "Enter" || !event.ctrlKey) return;
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

        if (containsSaEnvelope(v)) {
            log("wont write");
            return;
        }

        const path_b64 = btoa(JSON.stringify(keyChain));
        const value_b64 = btoa(JSON.stringify(v));
        execRawPy(`
import base64, json
_path = json.loads(base64.b64decode("${path_b64}").decode("utf-8"))
_value = json.loads(base64.b64decode("${value_b64}").decode("utf-8"))
_base = renpy.python.store_dicts["store"]
for _part in _path[:-1]:
    try:
        _base = _base[_part]
    except (KeyError, TypeError, IndexError):
        _base = getattr(_base, _part)
_last = _path[-1]
try:
    _base[_last] = _value
except (TypeError, KeyError):
    setattr(_base, _last, _value)
`);
    }

    function containsSaEnvelope(v) {
        if (v === null || typeof v !== "object") return false;
        if (typeof v.__sa__ === "string") return true;
        if (Array.isArray(v)) return v.some(containsSaEnvelope);
        return Object.values(v).some(containsSaEnvelope);
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

    setInterval(async function() {
        labelContainer.innerHTML = "";
        const labels = await getRenpyLabels();
        console.log(labels);

        for (const labelName of labels) {
            let labelEl = $e("div", labelContainer, { classes: ["sa-passage"] });
            $e("span", labelEl, { innerText: labelName, classes: ["sa-passage-name"] });
            let jumpButton = $e("span", labelEl, {
                innerText: "Jump",
                classes: ["sa-clickable"],
            });

            jumpButton.addEventListener("click", function () {
                execRawPy(
                    "def _fire():\n" +
                    "    renpy.config.periodic_callbacks.remove(_fire)\n" + 
                    `    renpy.jump("${labelName}")\n` +
                    "renpy.config.periodic_callbacks.append(_fire)"
                );
            });
        }
    }, 2500);

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
