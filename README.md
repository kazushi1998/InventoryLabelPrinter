# Inventory Label Printer

Desktop Electron app for printing inventory labels such as `TH02398` and `WS02397` on a local Windows PC.

The app is designed for a Citizen CLP-7201e style roll label printer, with local persistent counters to avoid duplicate labels.

## Features

- Modern Electron desktop interface
- Add, edit, and delete label formats
- Supports prefixes like `TH`, `WS`, `NE`, or anything else you need
- Persistent local counters to avoid duplicate labels
- Reprint previous batches without consuming new numbers
- Clear recent batch history with confirmation
- Font family selection
- Font size selection
- Preview updates with the selected font and size
- Printed labels use the selected font and size
- Citizen/CLP printers are auto-preferred when printing
- Print jobs use the configured label width and height as the printer page size, so a roll printer receives one label per page instead of an A4 sheet layout



## Data Storage

Runtime data is saved locally using Electron's app data folder as `store.json`. The repository does not include user data, printed batches, generated executables, or `node_modules`.
