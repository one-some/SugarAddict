browser.browserAction.onClicked.addListener(async function () {
  tabs = await browser.tabs.query({
    currentWindow: true,
    active: true,
  });

  for (const tab of tabs) {
    browser.tabs.sendMessage(tab.id, "init");
  }
});