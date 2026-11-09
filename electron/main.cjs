const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, net, protocol, screen } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DEV_URL = process.env.PET_DEV_URL;
const PET_HEIGHT = 400;
const ID_RE = /^[a-zA-Z0-9_-]+$/;

protocol.registerSchemesAsPrivileged([
  { scheme: "pet-asset", privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true } },
]);

let petWin = null;
let editorWin = null;
let tray = null;

// ---------- preset storage ----------
const presetsDir = () => path.join(app.getPath("userData"), "presets");
const configFile = () => path.join(app.getPath("userData"), "config.json");
const presetDir = (id) => {
  if (!ID_RE.test(id)) throw new Error(`invalid preset id: ${id}`);
  return path.join(presetsDir(), id);
};
const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
};

function seedPresets() {
  fs.mkdirSync(presetsDir(), { recursive: true });
  if (fs.readdirSync(presetsDir()).length > 0) return;
  const bundled = path.join(__dirname, "..", "resources", "presets");
  if (fs.existsSync(bundled)) fs.cpSync(bundled, presetsDir(), { recursive: true });
  if (fs.readdirSync(presetsDir()).length === 0) createPreset("My first pet");
}

function blankPreset(id, name) {
  return {
    version: 1, id, name, size: 160, entry: "stand",
    nodes: [{
      id: "stand", type: "simple", label: "Stand", position: { x: 80, y: 80 },
      facing: "keep", clip: null, dwellMs: [1000, 3000], speed: 0,
    }],
    edges: [],
  };
}

function createPreset(name) {
  const id = "preset-" + Date.now().toString(36);
  const preset = blankPreset(id, name || "New preset");
  fs.mkdirSync(path.join(presetDir(id), "assets"), { recursive: true });
  fs.writeFileSync(path.join(presetDir(id), "preset.json"), JSON.stringify(preset, null, 2));
  return preset;
}

function listPresets() {
  return fs.readdirSync(presetsDir())
    .filter((id) => ID_RE.test(id) && fs.existsSync(path.join(presetDir(id), "preset.json")))
    .map((id) => ({ id, name: readJson(path.join(presetDir(id), "preset.json"), {}).name || id }));
}

function getActive() {
  const list = listPresets();
  const saved = readJson(configFile(), {}).activePreset;
  if (list.some((p) => p.id === saved)) return saved;
  return list[0]?.id ?? null;
}

function setActive(id) {
  fs.writeFileSync(configFile(), JSON.stringify({ activePreset: id }));
  petWin?.webContents.send("pet:reload");
  rebuildTrayMenu();
}

function broadcastListChanged() {
  editorWin?.webContents.send("presets:changed");
  rebuildTrayMenu();
}

// ---------- IPC ----------
function registerIpc() {
  ipcMain.handle("presets:list", () => listPresets());
  ipcMain.handle("presets:getActive", () => getActive());
  ipcMain.handle("presets:setActive", (_e, id) => { presetDir(id); setActive(id); });
  ipcMain.handle("presets:load", (_e, id) => readJson(path.join(presetDir(id), "preset.json"), null));
  ipcMain.handle("presets:save", (_e, preset) => {
    fs.writeFileSync(path.join(presetDir(preset.id), "preset.json"), JSON.stringify(preset, null, 2));
    if (preset.id === getActive()) petWin?.webContents.send("pet:reload");
    broadcastListChanged();
  });
  ipcMain.handle("presets:create", (_e, name) => {
    const p = createPreset(name);
    broadcastListChanged();
    return p;
  });
  ipcMain.handle("presets:delete", (_e, id) => {
    fs.rmSync(presetDir(id), { recursive: true, force: true });
    if (listPresets().length === 0) createPreset("My first pet");
    petWin?.webContents.send("pet:reload");
    broadcastListChanged();
  });
  ipcMain.handle("assets:import", (_e, presetId, fileName, bytes) => {
    const dir = path.join(presetDir(presetId), "assets");
    fs.mkdirSync(dir, { recursive: true });
    const base = path.basename(String(fileName)).replace(/[^\w.\-]+/g, "_");
    const ext = path.extname(base);
    let name = base;
    for (let i = 1; fs.existsSync(path.join(dir, name)); i++) name = `${path.basename(base, ext)}_${i}${ext}`;
    fs.writeFileSync(path.join(dir, name), Buffer.from(bytes));
    return name;
  });
}

// pet-asset://<presetId>/<file> -> an asset inside the preset's directory
function registerAssetProtocol() {
  protocol.handle("pet-asset", (req) => {
    const url = new URL(req.url);
    const dir = path.join(presetDir(url.hostname), "assets");
    const file = path.join(dir, path.basename(decodeURIComponent(url.pathname)));
    return net.fetch(pathToFileURL(file).toString());
  });
}

// ---------- windows ----------
const webPrefs = { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true };

function load(win, page) {
  if (DEV_URL) win.loadURL(`${DEV_URL}/${page}.html`);
  else win.loadFile(path.join(__dirname, "..", "dist", `${page}.html`));
}

// Electron's screen API caches display info (stale when the Dock auto-hides or another app goes fullscreen),
// so ask AppKit directly for the bottom inset (Dock height; 0 when hidden or in fullscreen).
const { execFile } = require("child_process");
const INSET_JS = `ObjC.import("AppKit");ObjC.import("CoreGraphics");
const sc=$.NSScreen.screens.objectAtIndex(0);const f=sc.frame;
const list=ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo(1,0)))||[];
const fs=list.some(w=>w.kCGWindowLayer===0&&w.kCGWindowBounds&&w.kCGWindowBounds.X===0&&w.kCGWindowBounds.Width>=f.size.width-1&&w.kCGWindowBounds.Y+w.kCGWindowBounds.Height>=f.size.height-1);
const sw=f.size.width-1,sh=f.size.height-1;
const moving=list.some(w=>w.kCGWindowBounds&&w.kCGWindowBounds.Width>=sw&&w.kCGWindowBounds.Height>=sh&&w.kCGWindowBounds.X!==0);
JSON.stringify(moving?-1:fs?0:sc.visibleFrame.origin.y-f.origin.y)`; // -1 = space-switch animation in progress, reading is meaningless // another app fullscreen (a full-width window reaching the screen bottom, which the Dock normally blocks) => Dock is hidden
function bottomInset() {
  return new Promise((resolve) => {
    if (process.platform !== "darwin") return resolve(null);
    execFile("osascript", ["-l", "JavaScript", "-e", INSET_JS], { timeout: 2000 }, (err, out) => {
      const n = err ? NaN : Number(out);
      resolve(Number.isFinite(n) ? n : null);
    });
  });
}

// Returns null while a space switch animation is running (keep the current position).
async function petBounds() {
  const d = screen.getPrimaryDisplay();
  const { x, width } = d.workArea;
  const inset = await bottomInset();
  if (process.env.PET_DEBUG) require("fs").appendFileSync("/tmp/pet-debug.log", `${new Date().toISOString()} inset=${inset} bounds=${JSON.stringify(d.bounds)} work=${JSON.stringify(d.workArea)}\n`);
  if (inset === -1) return null;
  const bottom = inset == null ? d.workArea.y + d.workArea.height : d.bounds.y + d.bounds.height - inset;
  return { x, y: Math.round(bottom - PET_HEIGHT), width, height: PET_HEIGHT };
}

function createPetWindow() {
  const d0 = screen.getPrimaryDisplay().workArea;
  petWin = new BrowserWindow({
    x: d0.x, y: d0.y + d0.height - PET_HEIGHT, width: d0.width, height: PET_HEIGHT,
    frame: false, transparent: true, hasShadow: false, resizable: false,
    alwaysOnTop: true, focusable: false, skipTaskbar: true,
    backgroundColor: "#00000000",
    webPreferences: webPrefs,
  });
  petWin.setAlwaysOnTop(true, "screen-saver");
  petWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWin.setIgnoreMouseEvents(true);
  petWin.webContents.setBackgroundThrottling(false);
  load(petWin, "pet");
  // Dock show/hide/resize (or switching to a fullscreen app) changes workArea without a reliable event, so poll.
  // Only move once the reading has been stable for a few polls: space-switch animations make it flicker,
  // and we never reset to a default position, just adjust in place when the new state is confirmed.
  let busy = false, pending = null, streak = 0, desired = petWin.getBounds(), selfMove = false;
  const apply = (b) => { desired = b; selfMove = true; petWin.setBounds(b); selfMove = false; };
  // If macOS itself moves the window (e.g. re-constraining it on a space switch), put it straight back.
  petWin.on("moved", () => {
    if (!petWin || selfMove) return;
    const c = petWin.getBounds();
    if (process.env.PET_DEBUG) require("fs").appendFileSync("/tmp/pet-debug.log", `${new Date().toISOString()} MOVED y=${c.y} desired=${desired.y}\n`);
    if (c.y !== desired.y || c.x !== desired.x) apply(desired);
  });
  const refit = async () => {
    if (!petWin || busy) return;
    busy = true;
    try {
      const b = await petBounds();
      if (!petWin) return;
      if (!b) { pending = null; streak = 0; return; }
      const c = petWin.getBounds();
      if (b.x === c.x && b.y === c.y && b.width === c.width && b.height === c.height) { pending = null; streak = 0; return; }
      if (pending && pending.y === b.y && pending.x === b.x && pending.width === b.width) streak++;
      else { pending = b; streak = 1; }
      if (streak >= 3) { apply(b); pending = null; streak = 0; }
    } finally { busy = false; }
  };
  refit();
  const timer = setInterval(refit, 250);
  screen.on("display-metrics-changed", refit);
  petWin.on("closed", () => { clearInterval(timer); screen.removeListener("display-metrics-changed", refit); petWin = null; });
}

function openEditor() {
  if (editorWin) { editorWin.show(); editorWin.focus(); return; }
  editorWin = new BrowserWindow({ width: 1280, height: 800, title: "Pet Editor", webPreferences: webPrefs });
  load(editorWin, "editor");
  editorWin.on("closed", () => { editorWin = null; });
}

function rebuildTrayMenu() {
  if (!tray) return;
  const active = getActive();
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open editor", click: openEditor },
    { label: "Switch pet", submenu: listPresets().map((p) => ({
        label: p.name, type: "radio", checked: p.id === active, click: () => setActive(p.id),
    })) },
    { type: "separator" },
    { label: "Quit", role: "quit" },
  ]));
}

app.whenReady().then(() => {
  seedPresets();
  registerIpc();
  registerAssetProtocol();
  createPetWindow();
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle("🐾");
  rebuildTrayMenu();
  if (DEV_URL) openEditor();
});

app.on("window-all-closed", () => {}); // Stay in the tray: closing all windows does not quit
