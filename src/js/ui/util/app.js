let promptResolve = null;

const app = {};
export default app;

app.supportInstall = null;
app.showPrompt = null;
app.promptAvailable = new Promise(resolve => {
  promptResolve = () => {
    resolve(true);
  };
});

window.addEventListener('beforeinstallprompt', event => {
  if (typeof event.prompt === 'function') {
    app.showPrompt = () => { event.prompt(); };
  }
  app.supportInstall = true;
  promptResolve();
});

// It is wired to test if is running under Web App or from a webpage using CSS matching
const inBrowserMode = window.matchMedia('(display-mode: browser)');
const updateBrowserMode = inBrowser => {
  app.inBrowser = inBrowser;
  document.body.classList.remove('app-browser', 'app-installed');
  document.body.classList.add(inBrowser ? 'app-browser' : 'app-installed');
};
updateBrowserMode(inBrowserMode.matches);
inBrowserMode.addListener(event => {
  updateBrowserMode(inBrowserMode.matches);
});

// iOS doesn't suppport beforeinstallprompt event
// And I have no idea how to detect that we acturally support install Web App on these devices
// So we use the last sort way to detect User-Agent
app.hasIosInstallTip = ['iPhone', 'iPad'].includes(navigator.platform);

