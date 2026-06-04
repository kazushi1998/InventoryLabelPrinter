const state = {
  formats: [],
  batches: [],
  settings: {
    fontFamily: "Consolas",
    fontSizePt: 20
  },
  selectedFormatId: null,
  activeBatch: null,
  activeLabels: []
};

const $ = (selector) => document.querySelector(selector);

const elements = {
  formatRows: $("#formatRows"),
  selectedSummary: $("#selectedSummary"),
  printForm: $("#printForm"),
  quantityInput: $("#quantityInput"),
  formatForm: $("#formatForm"),
  nameInput: $("#nameInput"),
  prefixInput: $("#prefixInput"),
  nextNumberInput: $("#nextNumberInput"),
  digitsInput: $("#digitsInput"),
  widthInput: $("#widthInput"),
  heightInput: $("#heightInput"),
  saveFormatButton: $("#saveFormatButton"),
  addButton: $("#addButton"),
  deleteButton: $("#deleteButton"),
  refreshButton: $("#refreshButton"),
  fontFamilyInput: $("#fontFamilyInput"),
  fontSizeInput: $("#fontSizeInput"),
  labelPreview: $("#labelPreview"),
  previewMeta: $("#previewMeta"),
  typeBadge: $("#typeBadge"),
  printButton: $("#printButton"),
  batchList: $("#batchList"),
  clearBatchesButton: $("#clearBatchesButton"),
  toast: $("#toast")
};

window.addEventListener("error", (event) => {
  showToast(event.message || "Something went wrong.");
});

window.addEventListener("unhandledrejection", (event) => {
  showToast(event.reason?.message || "Something went wrong.");
});

function labelText(format, number = format.nextNumber) {
  return `${format.prefix}${String(number).padStart(format.digits, "0")}`;
}

function selectedFormat() {
  return state.formats.find((format) => format.id === state.selectedFormatId) || state.formats[0];
}

function setFormatInputsEnabled(enabled) {
  [
    elements.nameInput,
    elements.prefixInput,
    elements.nextNumberInput,
    elements.digitsInput,
    elements.widthInput,
    elements.heightInput,
    elements.saveFormatButton,
    elements.addButton
  ].forEach((element) => {
    element.disabled = !enabled;
  });
}

function applyPreviewTypography() {
  const fontFamily = state.settings.fontFamily || "Consolas";
  const fontSizePt = Number(state.settings.fontSizePt) || 20;
  elements.labelPreview.style.setProperty("--preview-font-family", `${cssString(fontFamily)}, Arial, sans-serif`);
  elements.labelPreview.style.setProperty("--preview-font-size", `${fontSizePt * 1.333}px`);
  elements.typeBadge.textContent = `${fontFamily} - ${fontSizePt} pt`;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => elements.toast.classList.remove("visible"), 3200);
}

function dateText(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function renderFormats() {
  if (!state.formats.length) {
    elements.formatRows.innerHTML = `
      <tr>
        <td colspan="5" class="empty-cell">No formats yet. Enter details below and click Add.</td>
      </tr>
    `;
    return;
  }

  elements.formatRows.innerHTML = state.formats
    .map((format) => `
      <tr data-format-id="${format.id}" class="${format.id === state.selectedFormatId ? "selected" : ""}">
        <td><strong>${format.prefix}</strong></td>
        <td>${format.name}</td>
        <td>${labelText(format)}</td>
        <td>${format.digits} digits</td>
        <td>${format.labelWidthMm} x ${format.labelHeightMm} mm</td>
      </tr>
    `)
    .join("");
}

function renderDetails() {
  const format = selectedFormat();
  if (!format) {
    state.selectedFormatId = null;
    elements.selectedSummary.textContent = "No formats yet. Add one below.";
    setFormatInputsEnabled(true);
    elements.saveFormatButton.textContent = "Add Format";
    elements.nameInput.value = elements.nameInput.value || "";
    elements.prefixInput.value = elements.prefixInput.value || "";
    elements.nextNumberInput.value = elements.nextNumberInput.value || 1;
    elements.digitsInput.value = elements.digitsInput.value || 5;
    elements.widthInput.value = elements.widthInput.value || 52;
    elements.heightInput.value = elements.heightInput.value || 25;
    elements.deleteButton.disabled = true;
    elements.printForm.querySelector("button[type='submit']").disabled = true;
    return;
  }

  setFormatInputsEnabled(true);
  elements.saveFormatButton.textContent = "Save";
  elements.deleteButton.disabled = false;
  elements.printForm.querySelector("button[type='submit']").disabled = false;
  state.selectedFormatId = format.id;
  elements.selectedSummary.textContent = `${labelText(format)}   ${format.labelWidthMm} x ${format.labelHeightMm} mm`;
  elements.nameInput.value = format.name;
  elements.prefixInput.value = format.prefix;
  elements.nextNumberInput.value = format.nextNumber;
  elements.digitsInput.value = format.digits;
  elements.widthInput.value = format.labelWidthMm;
  elements.heightInput.value = format.labelHeightMm;
}

function renderPreview() {
  syncSettingsFromInputs();
  applyPreviewTypography();
  if (!state.activeLabels.length) {
    elements.labelPreview.innerHTML = `<div class="empty">Generated labels will appear here.</div>`;
    elements.previewMeta.textContent = "No batch generated yet.";
    elements.printButton.disabled = true;
    return;
  }

  elements.previewMeta.textContent = `${state.activeLabels.length} labels: ${state.activeLabels[0]} to ${state.activeLabels[state.activeLabels.length - 1]}`;
  elements.labelPreview.innerHTML = state.activeLabels
    .map((label) => `<div class="label-tile">${label}</div>`)
    .join("");
  elements.printButton.disabled = false;
}

function cssString(value) {
  return JSON.stringify(String(value || "")).replace(/</g, "\\003c");
}

function renderBatches() {
  if (!state.batches.length) {
    elements.batchList.innerHTML = `<div class="empty">No batches yet.</div>`;
    elements.clearBatchesButton.disabled = true;
    return;
  }

  elements.clearBatchesButton.disabled = false;
  elements.batchList.innerHTML = state.batches
    .map((batch) => {
      const first = `${batch.prefix}${String(batch.startNumber).padStart(batch.digits, "0")}`;
      const last = `${batch.prefix}${String(batch.endNumber).padStart(batch.digits, "0")}`;
      return `
        <div class="batch-row">
          <div>
            <strong>${first} - ${last}</strong>
            <span>${batch.quantity} labels - ${dateText(batch.createdAt)}</span>
          </div>
          <button data-batch-id="${batch.id}" type="button">Load</button>
        </div>
      `;
    })
    .join("");
}

function renderAll() {
  renderFormats();
  renderDetails();
  renderPreview();
  renderBatches();
}

async function loadState() {
  const data = await window.labelPrinter.getState();
  state.settings = data.settings || state.settings;
  state.formats = data.formats;
  state.batches = data.batches;
  elements.fontFamilyInput.value = state.settings.fontFamily;
  elements.fontSizeInput.value = state.settings.fontSizePt;
  if (!state.formats.some((format) => format.id === state.selectedFormatId)) {
    state.selectedFormatId = state.formats[0]?.id || null;
  }
  renderAll();
}

function formPayload() {
  return {
    id: state.selectedFormatId,
    name: elements.nameInput.value,
    prefix: elements.prefixInput.value,
    nextNumber: Number(elements.nextNumberInput.value),
    digits: Number(elements.digitsInput.value),
    labelWidthMm: Number(elements.widthInput.value),
    labelHeightMm: Number(elements.heightInput.value)
  };
}

elements.formatRows.addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-format-id]");
  if (!row) return;
  state.selectedFormatId = row.dataset.formatId;
  renderFormats();
  renderDetails();
});

elements.formatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    if (!state.selectedFormatId) {
      const format = await window.labelPrinter.addFormat(formPayload());
      state.selectedFormatId = format.id;
      await loadState();
      showToast("Format added.");
      return;
    }
    await window.labelPrinter.saveFormat(formPayload());
    await loadState();
    showToast("Format saved.");
  } catch (error) {
    showToast(error.message);
  }
});

elements.addButton.addEventListener("click", async () => {
  try {
    const format = await window.labelPrinter.addFormat(formPayload());
    state.selectedFormatId = format.id;
    await loadState();
    showToast("Format added.");
  } catch (error) {
    showToast(error.message);
  }
});

elements.deleteButton.addEventListener("click", async () => {
  elements.deleteButton.disabled = true;
  try {
    const format = selectedFormat();
    if (!format) return;
    const confirmed = confirm(`Delete format ${format.prefix} - ${format.name}?\n\nExisting recent batches stay available for reprint.`);
    if (!confirmed) return;
    await window.labelPrinter.deleteFormat(format.id);
    state.selectedFormatId = null;
    state.activeBatch = null;
    state.activeLabels = [];
    await loadState();
    renderPreview();
    elements.prefixInput.focus();
    showToast("Format deleted.");
  } catch (error) {
    showToast(error.message);
  } finally {
    elements.deleteButton.disabled = !selectedFormat();
  }
});

elements.printForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const format = selectedFormat();
  if (!format) return;
  await saveSettingsFromInputs(false);
  const data = await window.labelPrinter.createBatch({
    formatId: format.id,
    quantity: Number(elements.quantityInput.value)
  });
  state.activeBatch = data.batch;
  state.activeLabels = data.labels;
  await loadState();
  renderPreview();
  showToast(`Reserved ${data.labels[0]} to ${data.labels[data.labels.length - 1]}.`);
});

elements.batchList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-batch-id]");
  if (!button) return;
  const data = await window.labelPrinter.getBatch(button.dataset.batchId);
  state.activeBatch = data.batch;
  state.activeLabels = data.labels;
  renderPreview();
  showToast("Batch loaded.");
});

elements.clearBatchesButton.addEventListener("click", async () => {
  if (!state.batches.length) return;
  const confirmed = confirm("Clear all recently printed batches?\n\nThis only clears the recent batch history. It does not roll back next label numbers.");
  if (!confirmed) return;
  await window.labelPrinter.clearBatches();
  state.activeBatch = null;
  state.activeLabels = [];
  await loadState();
  showToast("Recent batches cleared.");
});

elements.printButton.addEventListener("click", async () => {
  await saveSettingsFromInputs(false);
  const result = await window.labelPrinter.printLabels(state.activeBatch, state.activeLabels, state.settings);
  if (!result.success && result.failureReason) showToast(result.failureReason);
});

elements.refreshButton.addEventListener("click", loadState);

function syncSettingsFromInputs() {
  state.settings = {
    fontFamily: elements.fontFamilyInput.value || state.settings.fontFamily,
    fontSizePt: Number(elements.fontSizeInput.value) || state.settings.fontSizePt
  };
  applyPreviewTypography();
}

async function saveSettingsFromInputs(showSavedToast = true) {
  syncSettingsFromInputs();
  state.settings = await window.labelPrinter.saveSettings({
    fontFamily: state.settings.fontFamily,
    fontSizePt: state.settings.fontSizePt
  });
  renderPreview();
  if (showSavedToast) showToast("Font settings saved.");
}

elements.fontFamilyInput.addEventListener("change", () => saveSettingsFromInputs());
elements.fontSizeInput.addEventListener("input", () => {
  syncSettingsFromInputs();
  renderPreview();
});
elements.fontSizeInput.addEventListener("change", () => saveSettingsFromInputs());

loadState().catch((error) => showToast(error.message));
