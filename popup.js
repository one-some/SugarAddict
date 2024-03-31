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
    button.addEventListener("click", function() {
        button.classList.toggle("on");
        const enabled = button.classList.contains("on");
        this.innerText = enabled ? "Enabled" : "Disabled";

        button.dispatchEvent(new CustomEvent("toggle", {detail: {enabled: enabled}}));
    });

    button.setToggled = function(toggled) {
        const enabled = button.classList.contains("on");
        // HACK
        if (enabled !== toggled) button.click();
    }
}
