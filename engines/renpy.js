// TODO: sorted( renpy.python.store_dicts["store"].ever_been_changed )

const Module = window.wrappedJSObject.Module;
let history = [];
let historyPointer = 0;

function consoleWrite(out) { /* Stub */ }

// Hijack output function to process data
let outputListeners = [];
let errorListeners = [];

if (!window.wrappedJSObject.SA_OLDOUT) {
    exportFunction(window.wrappedJSObject.out.bind({}), window, { defineAs: "SA_OLDOUT" });
    exportFunction(window.wrappedJSObject.err.bind({}), window, { defineAs: "SA_OLDERR" });
}

exportFunction(function (text) {
    // window.wrappedJSObject.SA_OLDOUT(text);
    for (const listener of outputListeners) { listener(text); }
}, window, { defineAs: "out" });

exportFunction(function (text) {
    window.wrappedJSObject.SA_OLDERR(text);
    for (const listener of errorListeners) { listener(text); }
}, window, { defineAs: "err" });


// Run in Python VM
function execRawPy(code) {
    let pointer = string2stack(code);
    let ret = Module._PyRun_SimpleString(pointer);
    // Ret is -1 for error, 0 for success
}

function execPy(code) {
    // Lame workaround for non working passthrough stuff. builtins._ isn't set :^(
    if (code[0] === "\\") {
        code = code.slice(1);
        code = `print(${code})`;
    }
    execRawPy(code);
}

function initPythonVM() {
    // Experimental optimizations
    execRawPy(`import renpy
renpy.config.gc_thresholds = (10000, 10, 10)
renpy.config.image_cache_size_mb = 100
`);
    // Default is (25000, 10, 10)

}

function string2stack(string) {
    // Adapted from reverse engineered function. Puts a string on the stack or something
    let ret = 0;
    if (!string) return;

    let size = (string.length << 2) + 1;
    let pointer = window.wrappedJSObject.stackAlloc(size);
    window.wrappedJSObject.stringToUTF8(string, pointer, size);

    return pointer;
}

export async function initRenPyWeb() {
    console.log("[SA @ RenPy] Initializing Ren'PyWeb backend...");

    const { $e, $el } = await import(browser.runtime.getURL("util.js"));

    const { makeWindow } = await import(browser.runtime.getURL("window.js"));
    const tabs = await makeWindow({
        "home": { title: "Home", icon: "🏠" },
        "console": { title: "Player", icon: "🤹" },
    });

    /* Home */
    $e("span", tabs.home.content, { innerText: "Memory Management", classes: ["sa-header"] });
    const gcButton = $e("div", tabs.home.content, { innerText: "Force GC", classes: ["sa-nav-button"] });
    gcButton.addEventListener("click", function() {
        console.info("[SA @ RenPy] Trying GC collect")
        execPy("\\renpy.memory.gc.collect()")
    });

    const freeMemButton = $e("div", tabs.home.content, { innerText: "Try free_memory()", classes: ["sa-nav-button"] });
    freeMemButton.addEventListener("click", function() {
        execPy("\\renpy.exports.free_memory()")
    })

    /* Console */
    const consoleOutputEl = $e("div", tabs.console.content, { id: "sa-rp-console-output" });
    function consoleWrite(out, error = false) {
        const line = $e("div", consoleOutputEl, { innerText: out });
        if (error) line.classList.add("sa-log-error");
        line.scrollIntoView();
    }
    outputListeners.push((t) => consoleWrite(t));
    errorListeners.push(function(t) {
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
            let delta = (event.key === "ArrowUp") ? 1 : -1;

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
}

/* TODO:
 *         enableSkipping:  function() {
            LDS.RenPy.runPython(`
import renpy.config
renpy.config.allow_skipping = True`);
            },

            enableDeveloper: function() {
                LDS.RenPy.runPython(`
import renpy.config
renpy.config.developer = True`);
        }
        }
*/
