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

function createPetWindow() {
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
  petWin = new BrowserWindow({
    x, y: y + height - PET_HEIGHT, width, height: PET_HEIGHT,
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
  petWin.on("closed", () => { petWin = null; });
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
