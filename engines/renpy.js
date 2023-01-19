const Module = window.wrappedJSObject.Module;

// Hijack output function to process data
let outputListeners = [];
let oldOutFunc = window.wrappedJSObject.out;

exportFunction(function(text) {
    oldOutFunc(text);
    console.log("SAINTERCEPT", text);
    for (const listener of outputListeners) {
        listener(text);
    }
}, window, { defineAs: "out" });

function executePython(code) {
    console.warn(code)
    let pointer = string2stack(code);
    console.log("its here", pointer);
    Module._PyRun_SimpleString(pointer);
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
        "console": { title: "Player", icon: "🤹" },
    });

    const pyInput = $e("input", tabs.console.content);
    pyInput.addEventListener("keydown", function(event) {
        event.stopPropagation();
        if (event.key !== "Enter") return;
        event.preventDefault();
        executePython(pyInput.value);
        pyInput.value = "";
    });

    pyInput.addEventListener("keypress", function(event) {
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
