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
        ifId: document.querySelector("tw-storydata")?.getAttribute("ifid"),
    };
} else {
    const SCInfo = {
        title: SugarCube.Story.title,
        ifId: SugarCube.Story.ifId,
    };
}

/* Init */
export async function initSugarCube() {
    console.log("[SA @ SugarCube] Initializing SugarCube backend...");
    console.info(SugarCube);

    const TwineParser = await import(browser.runtime.getURL("twine_parser.js"));

    const tabs = await makeWindow({
        home: { title: "Home", icon: "🏠" },
        vars: { title: "Variables", icon: "🔧" },
        varlog: { title: "State Log", icon: "🔴" },
        passages: { title: "Passages", icon: "📔" },
        decompiler: { title: "Decompiler", icon: "💻" }, // Yes I know this isn't decompiling anything but it sounds cool
        patches: { title: "Patches", icon: "🩹" },
    });

    /* Twine Variables */

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
        {
            setVariable: setVariable,
            getVariables: getVariables,
            logVariableChange: logVariableChange
        },
        { bar: varSearchBar, container: varContainer },
        250
    );

    let currentPassage = null;
    const currentPassageLabel = $e("p", tabs.passages.content, {
        classes: ["sa-clickable"],
    });

    const passageListingModeContainer = $e("div", tabs.passages.content, { id: "sa-passage-modes" });

    let passageModes = {};
    let currentPassageMode;

    for (const [modeId, modeData] of Object.entries({
        "index": { label: "Index", tooltip: "Search quickly through the titles of passages" },
        "deep": { label: "Deep Search", tooltip: "Do a more rigorous search through the content of passages" }
    })) {
        let modeDat = { bodyEl: null, tabEl: null };
        passageModes[modeId] = modeDat;

        const bodyId = `sa-passage-mode-body-${modeId}`;
        modeDat.bodyEl = $e("div", tabs.passages.content, { classes: ["sa-passage-mode-body"], id: bodyId });

        modeDat.tabEl = $e(
            "div",
            passageListingModeContainer,
            { innerText: modeData.label, classes: ["sa-passage-mode"], "sap-tab": bodyId }
        );

        modeDat.tabEl.addEventListener("click", function () {
            currentPassageMode = modeDat.mode;

            for (const alienModeDat of Object.values(passageModes)) {
                // Make other tabs non-glowey
                alienModeDat.tabEl.classList.remove("sa-active");

                // Hide the body
                alienModeDat.bodyEl.classList.add("sa-hidden");
            }

            // Mark current tab as glowey and show body
            modeDat.tabEl.classList.add("sa-active");
            modeDat.bodyEl.classList.remove("sa-hidden");
        });
    }

    document.addEventListener("sc-passagechange", function (event) {
        currentPassage = event.detail;
        currentPassageLabel.innerText = `Current: ${event.detail}`;
    });

    currentPassageLabel.addEventListener("click", function () {
        SugarCube.Engine.play(currentPassage);
    });

    const passageContainer = $e("div", passageModes.index.bodyEl, {
        id: "sa-passage-container",
        classes: ["sa-scroller"],
    });
    const passageSearchbar = $e("input", passageModes.index.bodyEl, { placeholder: "Search titles" });

    function renderPassageListing(passageName, parent) {
        let passage = $e("div", parent, { classes: ["sa-passage"] });
        $e("span", passage, { innerText: passageName, classes: ["sa-passage-name"] });

        let buttons = $e("span", passage);;

        let jumpButton = $e("span", buttons, {
            innerText: "[Jump]",
            classes: ["sa-clickable", "sa-jump-btn"],
        });

        jumpButton.addEventListener("click", function () {
            SugarCube.Engine.play(passageName);
        });

        let decompButton = $e("span", buttons, {
            innerText: "[View]",
            classes: ["sa-clickable", "sa-view-passage-btn"],
        });

        decompButton.addEventListener("click", function () {
            targetPassage = passageName;
            decompilePassage(passageName);
            tabs.decompiler.focus();
        });

    }

    for (const name of Object.keys(getPassages())) {
        renderPassageListing(name, passageContainer);
    }

    passageSearchbar.addEventListener("input", function () {
        const query = processForSearch(passageSearchbar.value);

        for (const passageContainer of document.getElementsByClassName(
            "sa-passage"
        )) {
            const name = passageContainer.querySelector(".sa-passage-name").innerText;
            if (!query || processForSearch(name).includes(query)) {
                passageContainer.classList.remove("sa-hidden");
            } else {
                passageContainer.classList.add("sa-hidden");
            }
        }
        // updatePassageVisualPolarity();
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

    // Deep

    const deepPassageContainer = $e("div", passageModes.deep.bodyEl, {
        id: "sa-passage-search-container",
        classes: ["sa-scroller"],
    });
    const deepPassageSearchbarCont = $e("div", passageModes.deep.bodyEl, { id: "sa-deep-searchbar-cont" });
    const deepPassageSearchbar = $e("input", deepPassageSearchbarCont, { placeholder: "Search passages" });
    const deepPassageSearchButton = $e("button", deepPassageSearchbarCont, { innerText: "Search" });

    deepPassageSearchbar.addEventListener("keydown", function (event) {
        if (event.key === "Enter") deepPassageSearchButton.click();
    });

    deepPassageSearchButton.addEventListener("click", function () {
        // Deep search
        let query = processForSearch(deepPassageSearchbar.value);
        
        const isRegex = query[0] === "/" && query[query.length - 1] === "/";
        if (isRegex) {
            query = new RegExp(query.slice(1, -1), "is");
            console.log(query);
        }

        // Clear old results
        deepPassageContainer.innerHTML = "";

        for (const passage of Object.values(getPassages())) {
            // Match either title or contents
            if (
                !isRegex &&
                (
                    processForSearch(passage.title).includes(query)
                    || processForSearch(passage.element.innerText).includes(query)
                )
            ) {
                renderPassageListing(passage.title, deepPassageContainer);
                continue;
            }

            // Regex too

            if (
                isRegex &&
                (
                    query.test(processForSearch(passage.title))
                    || query.test(processForSearch(passage.element.innerText))
                )
            ) {
                renderPassageListing(passage.title, deepPassageContainer);
                continue;
            }
        }
    });

    // Mark first tab active automatically
    Object.values(passageModes)[0].tabEl.click();

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
    let twineTokenCache = {};

    function decompilePassage(passageName) {
        const passage = getPassages()[passageName];
        codeContainer.innerText = "";

        if (decompFancyInput.checked) {
            let tokens = twineTokenCache[passageName];

            if (!tokens) {
                tokens = TwineParser.parse(passage.element.innerText);
                twineTokenCache[passageName] = tokens;
            }

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

    $e(
        "label",
        decompBottomBar,
        {
            for: "sa-setting-fancy-proc",
            innerText: "Fancy Processing",
            title: "Still has some bugs, code returned may be incorrect"
        }
    );


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
    return 1337;
}
exportFunction(PATCH_1337, window, { defineAs: "SA_PATCH_1337" });

/* - Passage Data - */

function PATCH_TRUE() {
    return true;
}
exportFunction(PATCH_TRUE, window, { defineAs: "SA_PATCH_TRUE" });

function getPassages() {
    if (SugarCube.version.major === 1) return SugarCube.tale.passages;

    if (SugarCube.Story.passages !== undefined) return SugarCube.Story.passages;

    return (SugarCube.Story.getAllRegular ?? SugarCube.Story.getNormals)();
    // let ret = {};
    // for (const dat of SugarCube.Story.lookupWith(
    //     window.wrappedJSObject.SA_PATCH_TRUE
    // )) {
    //     ret[dat.title] = dat;
    // }
    // return ret;
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
                let assignmentSkeletons = [];

                if (!token.assignments) throw new Error("Set w/o assignments");

                for (const [name, value] of Object.entries(token.assignments)) {
                    assignmentSkeletons.push([
                        `<sat-set-name>${escapeHTML(name)}</sat-set-name>`,
                        `<sat-set-value>${escapeHTML(value)}</sat-set-value>`
                    ].join(" = "));
                }

                // assignmentSkeletons is now an array of "name = value" lookin' strings
                // Coalesce these into one "assignment chunk" we can just plunk in the macro
                const assignmentChunk = assignmentSkeletons.join(", ");

                el = $e("sat-set", parentElement, {
                    innerHTML: escapeHTML("<<set %s>>").replaceAll("%s", assignmentChunk)
                });
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
            case "else":
                $e(`sat-${token.type}`, parentElement, {
                    innerText: `<<else>>`,
                });
                break;
            case "endif":
                $e(`sat-${token.type}`, parentElement, {
                    innerText: `<</if>>`,
                });
                break;
            case "comment":
                $e(`sat-comment`, parentElement, {
                    innerText: `/%${token.text}%/`,
                });
                break;
            default:
                console.warn("??", token.type);
        }
    }
}
