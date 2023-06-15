/* Don't really like the current way is archected with most of the code in one
   function. Still learning the ropes of extensions so maybe there's a better
   way. If you happen to know of the aforementioned better way PLEEEEEEEEASE
   let me know. :^)
*/

const SugarCube = window.wrappedJSObject.SugarCube;
let SCInfo = {};

if (SugarCube.version.major === 1) {
    // Weak compatibility with old SC
    SugarCube.State = SugarCube.state;
    const SCInfo = {
        title: SugarCube.tale._title,
        ifId: document.querySelector("tw-storydata").getAttribute("ifid"),
    };
} else {
    const SCInfo = {
        title: SugarCube.Story.title,
        ifId: SugarCube.Story.ifId,
    };
}

// HACK: Global util
let util;
let $e = () => null;
let $el = () => null;

/* Init */
export async function initSugarCube() {
    console.log("[SA @ SugarCube] Initializing SugarCube backend...");
    console.info(SugarCube);

    // HACK: Global util
    util = await import(browser.runtime.getURL("ui/util.js"));
    $e = util.$e;
    $el = util.$el;

    const TwineParser = await import(browser.runtime.getURL("twine_parser.js"));

    const { makeWindow } = await import(browser.runtime.getURL("ui/window.js"));

    const tabs = await makeWindow({
        home: { title: "Home", icon: "🏠" },
        vars: { title: "Variables", icon: "🔧" },
        varlog: { title: "State Log", icon: "🔴" },
        passages: { title: "Passages", icon: "📔" },
        decompiler: { title: "Decompiler", icon: "💻" }, // Yes I know this isn't decompiling anything but it sounds cool
        patches: { title: "Patches", icon: "🩹" },
    });

    /* Twine Variables */

    if (SugarCube.version.major === 1) {
        SCInfo = {
            title: SugarCube.tale._title,
            ifId: $el("tw-storydata").getAttribute("ifid"),
        };
    } else {
        SCInfo = {
            title: SugarCube.Story.title,
            ifId: SugarCube.Story.ifId,
        };
    }

    const { renderVariable, varEditorInit } = await import(
        browser.runtime.getURL("ui/variable_editor.js")
    );

    function setVariable(path, value) {
        let ref = SugarCube.State.active.variables;

        for (const part of path.slice(0, -1)) {
            ref = ref[part];
        }

        ref[path[path.length - 1]] = value;
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

    function getVariables() {
        return SugarCube.State.active.variables;
    }

    const varContainer = $e("div", tabs.vars.content, {
        id: "sa-var-cont",
        classes: ["sa-scroller"],
    });
    const varSearchBar = $e("input", tabs.vars.content);

    await varEditorInit(
        setVariable,
        getVariables,
        logVariableChange,
        { bar: varSearchBar, container: varContainer },
        250
    );

    let currentPassage = null;
    const currentPassageLabel = $e("p", tabs.passages.content, {
        classes: ["sa-clickable"],
    });
    document.addEventListener("sc-passagechange", function (event) {
        currentPassage = event.detail;
        currentPassageLabel.innerText = `Current: ${event.detail}`;
    });

    currentPassageLabel.addEventListener("click", function () {
        SugarCube.Engine.play(currentPassage);
    });

    const passageContainer = $e("div", tabs.passages.content, {
        id: "sa-passage-container",
        classes: ["sa-scroller"],
    });
    const passageSearchbar = $e("input", tabs.passages.content);

    function initPassages() {
        for (const [name, data] of Object.entries(getPassages())) {
            let passage = $e("div", passageContainer, { classes: ["sa-passage"] });
            $e("span", passage, { innerText: name, classes: ["sa-passage-name"] });

            let buttons = $e("span", passage);;

            let jumpButton = $e("span", buttons, {
                innerText: "[Jump]",
                classes: ["sa-clickable", "sa-jump-btn"],
            });

            jumpButton.addEventListener("click", function () {
                SugarCube.Engine.play(name);
            });

            let decompButton = $e("span", buttons, {
                innerText: "[View]",
                classes: ["sa-clickable", "sa-view-passage-btn"],
            });

            decompButton.addEventListener("click", function () {
                targetPassage = name;
                decompilePassage(name);
                tabs.decompiler.focus();
            });
        }
    }
    initPassages();

    passageSearchbar.addEventListener("input", function () {
        let query = processForSearch(passageSearchbar.value);
        for (const passageContainer of document.getElementsByClassName(
            "sa-passage"
        )) {
            let name = passageContainer.querySelector(".sa-passage-name").innerText;
            if (!query || processForSearch(name).includes(query)) {
                passageContainer.classList.remove("sa-hidden");
            } else {
                passageContainer.classList.add("sa-hidden");
            }
        }
        updatePassageVisualPolarity();
    });

    function updatePassageVisualPolarity() {
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

    /* Home */

    const homeTitle = $e("p", tabs.home.content, {
        id: "sa-home-title",
        innerText: SCInfo.title,
    });

    const navContainer = $e("div", tabs.home.content, { id: "sa-nav-container" });
    const navBack = $e("div", navContainer, {
        innerText: "<--",
        classes: ["sa-nav-button"],
    });
    const navForward = $e("div", navContainer, {
        innerText: "-->",
        classes: ["sa-nav-button"],
    });

    navBack.addEventListener("click", function () {
        SugarCube.State.backward();
    });
    navForward.addEventListener("click", function () {
        SugarCube.State.forward();
    });

    let compatColor = "gold";
    let compatInfo = "Support is unknown for this version of SugarCube";
    if (SugarCube.version.major === 2) {
        compatColor = "green";
        compatInfo = "SugarCube v2.0 is usually supported";
    } else if (SugarCube.version.major == 1) {
        compatColor = "red";
        compatInfo =
            "SugarCube v1.0 has some compatibility, but is usually unsupported. Expect nothing to work";
    }

    const versionInfo = $e("p", tabs.home.content, {
        "style.color": compatColor,
        title: compatInfo,
        innerText: SugarCube.version.long(),
    });

    /* Var Log */

    let cachedTitle;
    let monitoringInterval = setInterval(watchForChanges, 250);
    function watchForChanges() {
        // Passage title
        let title = SugarCube.State.active.title;
        if (title !== cachedTitle) {
            document.dispatchEvent(
                new CustomEvent("sc-passagechange", { detail: title })
            );
            cachedTitle = title;
        }
    }

    document.addEventListener("sc-passagechange", function (event) {
        const container = $e(
            "div",
            tabs.varlog.content,
            { innerText: event.detail, classes: ["sa-varlog-passage"] },
            { before: tabs.varlog.content.firstChild }
        );
    });

    /* Decompiler */

    const codeContainer = $e("div", tabs.decompiler.content, { id: "sa-code-container" });
    let targetPassage;

    function decompilePassage(passageName) {
        const passage = getPassages()[passageName];
        codeContainer.innerText = "";

        if (decompFancyInput.checked) {
            const tokens = TwineParser.parse(passage.element.innerText);
            reconstructPassage(tokens, codeContainer);
        } else {
            codeContainer.innerText = passage.element.innerText;
        }
    }

    document.addEventListener("sc-passagechange", function (event) {
        targetPassage = event.detail;
        decompilePassage(event.detail);
    });

    tabs.decompiler.leaveHandlers.push(function () {
        if (targetPassage === currentPassage) return;
        targetPassage = currentPassage;
        decompilePassage(currentPassage);
    });

    const decompBottomBar = $e("div", tabs.decompiler.content, { id: "sa-decomp-bottom-bar" });

    const decompFancyInput = $e(
        "input",
        decompBottomBar,
        {
            id: "sa-setting-fancy-proc",
            type: "checkbox",
            classes: ["sa-red-green"],
            "checked": true
        }
    );

    decompFancyInput.addEventListener("change", function () {
        decompilePassage(targetPassage);
    });

    $e("label", decompBottomBar, { for: "sa-setting-fancy-proc", innerText: "Fancy Processing" });


    await initPatches(tabs);
}

async function initPatches(tabs) {
    console.log("Finding patches for", SCInfo.ifId);

    try {
        const patchMod = await import(
            browser.runtime.getURL(`patches/sugarcube/${SCInfo.ifId}.js`)
        );
        for (const patch of patchMod.PATCHDATA.patches) {
            console.log("Loaded", patch.label);
            const button = $e("div", tabs.patches.content, {
                innerText: patch.label,
                classes: ["sa-nav-button"],
            });
            button.addEventListener("click", patch.func);
        }
    } catch (error) {
        $e("p", tabs.patches.content, { classes: ["sa-yellow"], innerText: "No patches available for current story." });
        console.log("No patches for current story! :^(", error);
    }
}

function PATCH_1337(...x) {
    return true;
}
exportFunction(PATCH_1337, window, { defineAs: "SA_PATCH_1337" });

/* - Passage Data - */

function PATCH_TRUE() {
    return true;
}
exportFunction(PATCH_TRUE, window, { defineAs: "SA_PATCH_TRUE" });

function getPassages() {
    if (SugarCube.version.major === 1) return SugarCube.tale.passages;

    let ret = {};
    for (const dat of SugarCube.Story.lookupWith(
        window.wrappedJSObject.SA_PATCH_TRUE
    )) {
        ret[dat.title] = dat;
    }
    return ret;
}

function processForSearch(string) {
    string = string.toLowerCase();
    string = string.replaceAll(/\s/g, "");
    return string;
}

/* Decompiler */

function escapeHTML(str) {
    return new Option(str).innerHTML;
}

function clickDecompilerLink(link) {
    if (!Object.keys(getPassages()).includes(link)) return;
    SugarCube.Engine.play(link);
}

function renderCondition(cond, parentElement) {
    let el = $e("sat-if-cond", parentElement);

    for (const chunk of cond.split(" ")) {
        if (chunk[0] === "$") {
            $e("sat-if-var", el, { innerText: chunk });
            // TODO: Jump to var
        } else {
            el.append(chunk);
        }
    }
}

function reconstructPassage(tokens, parentElement) {
    for (const token of tokens) {
        let el;
        switch (token.type) {
            case "text":
                $e("sat-text", parentElement, { innerText: token.content });
                break;
            case "link":
                let text = `[[${token.url}]]`;
                if (token.linkText) {
                    text = `[[${token.linkText}|${token.url}]]`;
                }
                const link = $e("sat-link", parentElement, { innerText: text });
                link.addEventListener("click", function () {
                    clickDecompilerLink(token.url);
                });
                break;
            case "set":
                el = $e("sat-set", parentElement, {
                    innerText: "<<set {var} = {val}>>",
                });
                // Ugly but it works
                el.innerHTML = el.innerHTML.replaceAll(
                    "{var}",
                    `<sat-set-name>${escapeHTML(token.varName)}</sat-set-name>`
                );
                el.innerHTML = el.innerHTML.replaceAll(
                    "{val}",
                    `<sat-set-value>${escapeHTML(token.varValue)}</sat-set-value>`
                );
                break;
            case "if":
                el = $e("sat-if", parentElement, { innerText: "<<if " });
                renderCondition(token.condition, el);
                el.append(">>");
                break;
            case "include":
                el = $e("sat-include", parentElement, {
                    innerText: '<<include "{cond}">>',
                });
                // TODO: Hotlinking
                el.innerHTML = el.innerHTML.replaceAll(
                    "{cond}",
                    `<sat-include-passage>${escapeHTML(
                        token.passage
                    )}</sat-include-passage>`
                );
                break;
            case "endif":
            case "else":
                $e(`sat-${token.type}`, parentElement, {
                    innerText: `<<${token.type}>>`,
                });
                break;
            default:
                console.warn("??", token.type);
        }
    }
}
