const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DEFAULT_STORE = {
  settings: {
    fontFamily: "Consolas",
    fontSizePt: 20
  },
  formats: [
    {
      id: "fmt-th",
      name: "Thermal labels",
      prefix: "TH",
      digits: 5,
      nextNumber: 2398,
      labelWidthMm: 52,
      labelHeightMm: 25
    },
    {
      id: "fmt-ws",
      name: "Workstation labels",
      prefix: "WS",
      digits: 5,
      nextNumber: 2397,
      labelWidthMm: 52,
      labelHeightMm: 25
    }
  ],
  batches: []
};

let mainWindow;

function logError(source, error) {
  try {
    const message = `[${new Date().toISOString()}] ${source}: ${error?.stack || error?.message || error}\n`;
    fs.appendFileSync(path.join(app.getPath("userData"), "error.log"), message);
  } catch {
    // Logging should never block the app.
  }
}

function storePath() {
  return path.join(app.getPath("userData"), "store.json");
}

function ensureStore() {
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(DEFAULT_STORE, null, 2));
  }
}

function readStore() {
  ensureStore();
  const store = JSON.parse(fs.readFileSync(storePath(), "utf8"));
  if (!store.settings) store.settings = { ...DEFAULT_STORE.settings };
  if (!store.settings.fontFamily) store.settings.fontFamily = DEFAULT_STORE.settings.fontFamily;
  if (!store.settings.fontSizePt) store.settings.fontSizePt = DEFAULT_STORE.settings.fontSizePt;
  return store;
}

function writeStore(store) {
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2));
}

function normalizePrefix(prefix) {
  return String(prefix || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

function positiveInt(value, fallback, max = 999999999) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > max) return fallback;
  return number;
}

function labelText(prefix, digits, number) {
  return `${prefix}${String(number).padStart(digits, "0")}`;
}

function labelsForBatch(batch) {
  return Array.from({ length: batch.quantity }, (_, index) =>
    labelText(batch.prefix, batch.digits, batch.startNumber + index)
  );
}

function publicState() {
  const store = readStore();
  return {
    settings: store.settings,
    formats: store.formats,
    batches: store.batches.slice(-20).reverse(),
    storePath: storePath()
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 780,
    minWidth: 1040,
    minHeight: 680,
    title: "Inventory Label Printer",
    backgroundColor: "#f3f6fa",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  ensureStore();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("state:get", () => {
  return publicState();
});

ipcMain.handle("settings:save", (_event, settings) => {
  const store = readStore();
  store.settings = {
    fontFamily: String(settings.fontFamily || DEFAULT_STORE.settings.fontFamily),
    fontSizePt: positiveInt(settings.fontSizePt, DEFAULT_STORE.settings.fontSizePt, 72)
  };
  writeStore(store);
  return publicState();
});

ipcMain.handle("format:save", (_event, payload) => {
  const store = readStore();
  const format = store.formats.find((item) => item.id === payload.id);
  if (!format) throw new Error("Format not found.");

  const prefix = normalizePrefix(payload.prefix);
  if (!prefix) throw new Error("Prefix is required.");

  format.name = String(payload.name || `${prefix} labels`).trim();
  format.prefix = prefix;
  format.digits = positiveInt(payload.digits, format.digits, 12);
  format.nextNumber = positiveInt(payload.nextNumber, format.nextNumber);
  format.labelWidthMm = positiveInt(payload.labelWidthMm, format.labelWidthMm, 210);
  format.labelHeightMm = positiveInt(payload.labelHeightMm, format.labelHeightMm, 100);

  writeStore(store);
  return { format, state: publicState() };
});

ipcMain.handle("format:add", (_event, payload) => {
  const store = readStore();
  const prefix = normalizePrefix(payload.prefix);
  if (!prefix) throw new Error("Prefix is required.");

  const format = {
    id: crypto.randomUUID(),
    name: String(payload.name || `${prefix} labels`).trim(),
    prefix,
    digits: positiveInt(payload.digits, 5, 12),
    nextNumber: positiveInt(payload.nextNumber, 1),
    labelWidthMm: positiveInt(payload.labelWidthMm, 52, 210),
    labelHeightMm: positiveInt(payload.labelHeightMm, 25, 100)
  };

  store.formats.push(format);
  writeStore(store);
  return { format, state: publicState() };
});

ipcMain.handle("format:delete", (_event, formatId) => {
  const store = readStore();
  const nextFormats = store.formats.filter((format) => format.id !== formatId);
  if (nextFormats.length === store.formats.length) throw new Error("Format not found.");
  store.formats = nextFormats;
  writeStore(store);
  return publicState();
});

ipcMain.handle("batches:clear", () => {
  const store = readStore();
  store.batches = [];
  writeStore(store);
  return publicState();
});

ipcMain.handle("batch:create", (_event, payload) => {
  const quantity = positiveInt(payload.quantity, 0, 1000);
  if (!quantity) throw new Error("Quantity must be between 1 and 1000.");

  const store = readStore();
  const format = store.formats.find((item) => item.id === payload.formatId);
  if (!format) throw new Error("Format not found.");

  const batch = {
    id: crypto.randomUUID(),
    formatId: format.id,
    formatName: format.name,
    prefix: format.prefix,
    digits: format.digits,
    startNumber: format.nextNumber,
    endNumber: format.nextNumber + quantity - 1,
    quantity,
    labelWidthMm: format.labelWidthMm,
    labelHeightMm: format.labelHeightMm,
    createdAt: new Date().toISOString()
  };

  format.nextNumber += quantity;
  store.batches.push(batch);
  writeStore(store);
  return { batch, labels: labelsForBatch(batch) };
});

ipcMain.handle("batch:get", (_event, batchId) => {
  const store = readStore();
  const batch = store.batches.find((item) => item.id === batchId);
  if (!batch) throw new Error("Batch not found.");
  return { batch, labels: labelsForBatch(batch) };
});

ipcMain.handle("print:labels", async (_event, batch, labels, settings) => {
  const fontFamily = String(settings?.fontFamily || DEFAULT_STORE.settings.fontFamily);
  const fontSizePt = positiveInt(settings?.fontSizePt, DEFAULT_STORE.settings.fontSizePt, 72);
  const labelWidthMicrons = Math.round(Number(batch.labelWidthMm) * 1000);
  const labelHeightMicrons = Math.round(Number(batch.labelHeightMm) * 1000);
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  const labelHtml = labels
    .map((label) => `<section class="label">${label}</section>`)
    .join("");
  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page {
          size: ${batch.labelWidthMm}mm ${batch.labelHeightMm}mm;
          margin: 0;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: ${JSON.stringify(fontFamily)}, Arial, sans-serif;
          color: #000;
          background: #fff;
        }
        .label {
          width: ${batch.labelWidthMm}mm;
          height: ${batch.labelHeightMm}mm;
          display: flex;
          align-items: center;
          justify-content: center;
          break-after: page;
          page-break-after: always;
          border: 1px solid #000;
          font-size: ${fontSizePt}pt;
          font-weight: 900;
          overflow: hidden;
          white-space: nowrap;
        }
        .label:last-child {
          break-after: auto;
          page-break-after: auto;
        }
      </style>
    </head>
    <body>${labelHtml}</body>
  </html>`;

  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const printers = await mainWindow.webContents.getPrintersAsync();
  const citizen = printers.find((printer) => /citizen|clp-?7201/i.test(printer.name));
  return new Promise((resolve) => {
    printWindow.webContents.print(
      {
        silent: false,
        deviceName: citizen ? citizen.name : undefined,
        printBackground: true,
        pageSize: {
          width: labelWidthMicrons,
          height: labelHeightMicrons
        },
        margins: { marginType: "none" }
      },
      (success, failureReason) => {
        printWindow.close();
        resolve({ success, failureReason });
      }
    );
  });
});

process.on("uncaughtException", (error) => logError("uncaughtException", error));
process.on("unhandledRejection", (error) => logError("unhandledRejection", error));
