/* Don't really like the current way is archected with most of the code in one
   function. Still learning the ropes of extensions so maybe there's a better
   way. If you happen to know of the aforementioned better way PLEEEEEEEEASE
   let me know. :^)
*/

const SugarCube = window.wrappedJSObject.SugarCube;

// HACK: Global util
let $e = () => null;
let $el = () => null;

/* Init */
export async function initSugarCube() {
    console.log("[SA @ SugarCube] Initializing SugarCube backend...");
    console.info(SugarCube)

    // HACK: Global util
    const util = await import(browser.runtime.getURL("ui/util.js"));
    $e = util.$e;
    $el = util.$el;

    const { makeWindow } = await import(browser.runtime.getURL("ui/window.js"));

    const tabs = await makeWindow({
        "home": { title: "Home", icon: "🏠" },
        "vars": { title: "Variables", icon: "🔧" },
        "varlog": { title: "State Log", icon: "🔴" },
        "passages": { title: "Passages", icon: "📔" },
        "decompiler": { title: "Decompiler", icon: "💻" }, // Yes I know this isn't decompiling anything but it sounds cool
    });


    /* Twine Variables */

    const { renderVariable, varEditorInit } = await import(browser.runtime.getURL("ui/variable_editor.js"));

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

    await varEditorInit(setVariable, getVariables, logVariableChange);

    let i = 0;
    for (const [key, value] of Object.entries(SugarCube.State.active.variables)) {
        renderVariable(key, value, tabs.vars.content, i);
        i++;
    }


    let currentPassage = null;
    const currentPassageLabel = $e("p", tabs.passages.content, { classes: ["sa-clickable"] });
    document.addEventListener("sc-passagechange", function (event) {
        currentPassage = event.detail;
        currentPassageLabel.innerText = `Current: ${event.detail}`;
    });

    currentPassageLabel.addEventListener("click", function () {
        SugarCube.Engine.play(currentPassage);
    })

    const passageContainer = $e("div", tabs.passages.content, { id: "sa-passage-container" });
    const passageSearchbar = $e("input", tabs.passages.content);

    function initPassages() {
        for (const [name, data] of Object.entries(getPassages())) {
            let passage = $e("div", passageContainer, { classes: ["sa-passage"] });
            $e("span", passage, { innerText: name, classes: ["sa-passage-name"] });
            let jumpButton = $e("span", passage, { innerText: "Jump", classes: ["sa-clickable"] });

            jumpButton.addEventListener("click", function () {
                SugarCube.Engine.play(name);
            });
        }
    }
    initPassages();

    passageSearchbar.addEventListener("input", function () {
        let query = processForSearch(passageSearchbar.value);
        for (const passageContainer of document.getElementsByClassName("sa-passage")) {
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
        for (const [i, passageContainer] of Object.entries(document.querySelectorAll(".sa-passage:not(.sa-hidden)"))) {
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
        innerText: SugarCube.Story.title,
    });

    const navContainer = $e("div", tabs.home.content, { id: "sa-nav-container" });
    const navBack = $e("div", navContainer, { innerText: "<--", classes: ["sa-nav-button"] })
    const navForward = $e("div", navContainer, { innerText: "-->", classes: ["sa-nav-button"] })

    navBack.addEventListener("click", function () { SugarCube.State.backward(); });
    navForward.addEventListener("click", function () { SugarCube.State.forward(); });


    /* Var Log */

    let cachedTitle;
    let monitoringInterval = setInterval(watchForChanges, 250);
    function watchForChanges() {
        // Passage title
        let title = SugarCube.State.active.title;
        if (title !== cachedTitle) {
            document.dispatchEvent(new CustomEvent(
                "sc-passagechange",
                { detail: title }
            ))
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

    const codeContainer = $e("div", tabs.decompiler.content);

    document.addEventListener("sc-passagechange", function (event) {
        let passage = getPassages()[event.detail];
        // console.info(tokenizePassage(passage.element.innerText));
        codeContainer.innerText = passage.element.innerText;
    });

}

/* - Passage Data - */

function PATCH_TRUE() { return true; }
exportFunction(PATCH_TRUE, window, { defineAs: "SA_PATCH_TRUE" });

function getPassages() {
    let ret = {};
    for (const dat of SugarCube.Story.lookupWith(window.wrappedJSObject.SA_PATCH_TRUE)) {
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

function tokenizePassage(text) {
    // work SMART not WELL (Read: this is a silly but effective(??) hack)
    text = text.replaceAll('"', '\\"');
    text = text.replaceAll("\\'", "'");
    //text = text.replaceAll("\\", "\\\\");
    text = text.replaceAll("<</", '{"origin": "twine","direction":"close","content":"');
    text = text.replaceAll("<<", '{"origin": "twine","direction":"open","content":"');
    text = text.replaceAll(">>", '"},');
    text = text.replaceAll("</", '{"origin": "html","direction":"close","content":"');
    text = text.replaceAll("<", '{"origin": "html","direction":"open","content":"');
    text = text.replaceAll(">", '"},');

    // Get rid of last comma
    let jsonBuffer = `[${text.slice(0, -1)}]`;
    console.log(jsonBuffer);
    let parsed = JSON.parse(jsonBuffer);
    console.log(parsed);

    let breadcrumbTrail = [];

    for (const [i, parseNode] of Object.entries(parsed)) {
        parsed[i].type = parseNode.content.split(" ")[0]
    }

    function doesClose(type) {
        // uuuuuuh hack
        for (const parseNode of parsed) {
            if (parseNode.type === type && parseNode.direction === "close") return true;
        }
        return false;
    }

    let nodes = [];

    function getCurrentAdoptingParent() {
        if (!nodes.length) return nodes;
        let possibleParent = nodes[nodes.length - 1];

        let goodParents = [];

        while (possibleParent) {
            if (!possibleParent.completed) goodParents.push(possibleParent);
            possibleParent = possibleParent.children[possibleParent.children - 1];
        }
        console.log(goodParents);
        if (!goodParents.length) throw new Error("Nobody wants to adopt :(");

        // Deepest accepting parent
        return goodParents[goodParents.length - 1].children;
    }

    for (const parseNode of parsed) {
        if (parseNode.direction === "open") {
            let nodeCompleted = !doesClose(parseNode.type);
            let parentReference = getCurrentAdoptingParent();

            let node = {
                origin: parseNode.origin,
                type: parseNode.type,
                content: parseNode.content,
                completed: nodeCompleted,
                children: []
            };
            parentReference.push(node)

            if (nodeCompleted) continue;

            breadcrumbTrail.push({ origin: parseNode.origin, type: parseNode.type, node: node });
            console.log("entering", breadcrumbTrail);
        } else {
            // Closing
            console.log(parseNode)
            let lastBreadcrumb = breadcrumbTrail[breadcrumbTrail.length - 1];

            if (lastBreadcrumb.origin !== parseNode.origin) throw new Error(`Origin mismatch: breadcrumb ${lastBreadcrumb.origin}, parsenode ${parseNode.origin}`);
            if (lastBreadcrumb.type !== parseNode.type) throw new Error(`Type mismatch: breadcrumb ${lastBreadcrumb.type}, parsenode ${parseNode.type}`);

            lastBreadcrumb.node.completed = true;

            breadcrumbTrail = breadcrumbTrail.slice(0, -1);
            console.log("exiting");
        }
    }

    return nodes;
}
