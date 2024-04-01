document.addEventListener("keydown", function(event) {
    if (event.key !== "Enter") return;
    if (document.activeElement.nodeName !== "INPUT") return;
    document.activeElement.blur();
});

for (const slider of document.querySelectorAll("slider")) {
    const label = slider.querySelector("i-label");
    const input = slider.querySelector("input");

    function update() {
        label.innerText = input.value;
    }

    input.setValue = function(value) {
        input.value = value;
        update();
    }

    input.addEventListener("input", update);
    update();
}

for (const button of document.querySelectorAll("toggle-button")) {
    button.enabled = button.classList.contains("on");

    button.addEventListener("click", function() {
        button.classList.toggle("on");
        const enabled = button.classList.contains("on");
        this.enabled = enabled;
        this.innerText = enabled ? "Enabled" : "Disabled";

        button.dispatchEvent(new CustomEvent("toggle", {detail: {enabled: enabled}}));
    });

    button.setToggled = function(toggled) {
        const enabled = button.classList.contains("on");
        // HACK
        if (enabled !== toggled) button.click();
    }
}

for (const [i, tab] of Object.entries(document.querySelectorAll("tab"))) {
    console.log(tab);
    tab.addEventListener("click", function() {
        for (const tabEl of document.querySelectorAll("tab")) {
            tabEl.classList.toggle("selected", tabEl === tab);
        }

        const tabName = tab.getAttribute("tab");
        for (const contentEl of document.querySelectorAll("tab-content")) {
            const selected = contentEl.getAttribute("tab") === tabName;
            contentEl.classList.toggle("selected", selected);
            if (selected) contentEl.dispatchEvent(
                new CustomEvent("show")
            );
        }
    });

    // Bah, humbug!
    if (tab.hasAttribute("default")) tab.click();
}
