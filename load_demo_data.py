"""Load lot_manager_lookup.json and serve it locally for PWA testing.

Creates a local copy of the JSON at demo_data.json so the PWA can
fetch it from localhost instead of Google Drive during development.
"""
import json
import shutil
import os

SRC = os.path.expanduser(r"~\OneDrive\Desktop\Claude Toolkit\lot-manager-pwa")
DRIVE_EXPORT = os.path.expanduser(
    r"~\OneDrive\Desktop\Claude Toolkit\lot_manager_lookup.json"
)
# Also check the FTRV Lot Reports folder
ALT_PATH = os.path.expanduser(
    r"~\OneDrive\Desktop\FTRV Lot Reports\lot_manager_lookup.json"
)

dst = os.path.join(SRC, "demo_data.json")

# Find the source JSON
src = None
for p in [DRIVE_EXPORT, ALT_PATH]:
    if os.path.exists(p):
        src = p
        break

if not src:
    # Try generating it
    print("JSON not found locally. Running pipeline...")
    os.system("python " + os.path.join(SRC, "..", "pipelines", "lot_manager_json_export.py"))
    for p in [DRIVE_EXPORT, ALT_PATH]:
        if os.path.exists(p):
            src = p
            break

if src:
    shutil.copy2(src, dst)
    with open(dst, "r", encoding="utf-8") as f:
        data = json.load(f)
    unit_count = len(data.get("units", {}))
    print(f"Copied {src}")
    print(f"  -> {dst}")
    print(f"  {unit_count} units")
else:
    print("ERROR: Could not find lot_manager_lookup.json")
    print("Run: python pipelines/lot_manager_json_export.py")
