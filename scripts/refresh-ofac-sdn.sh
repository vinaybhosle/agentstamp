#!/usr/bin/env bash
# Refresh OFAC SDN sanctioned crypto addresses
# Downloads the latest SDN list from US Treasury and extracts
# all "Digital Currency Address" entries into data/sanctioned-addresses.json
#
# Run daily via launchd or cron.
# After updating the file, sends SIGHUP to the backend to trigger hot-reload.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$PROJECT_DIR/data"
OUTPUT_FILE="$DATA_DIR/sanctioned-addresses.json"
TEMP_FILE="$DATA_DIR/.sdn-temp.xml"

# OFAC SDN list in XML format (includes digital currency addresses)
SDN_URL="https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN_ADVANCED.XML"

echo "[$(date -Iseconds)] OFAC SDN refresh starting..."

# Download
curl -sSL --max-time 300 --retry 2 -o "$TEMP_FILE" "$SDN_URL"

if [ ! -s "$TEMP_FILE" ]; then
  echo "[$(date -Iseconds)] ERROR: Downloaded file is empty"
  rm -f "$TEMP_FILE"
  exit 1
fi

# Extract crypto addresses using regex (faster than XML parsing for 123MB file)
# Matches: Ethereum (0x...), Bitcoin (1.../3...), Bech32 (bc1...), Tron (T...)
python3 -c "
import re, json, sys

with open('$TEMP_FILE', 'r', errors='ignore') as f:
    content = f.read()

addresses = set()

# Ethereum addresses (EVM chains)
for m in re.finditer(r'>(0x[0-9a-fA-F]{40})<', content):
    addresses.add(m.group(1))

# Bitcoin legacy addresses
for m in re.finditer(r'>([13][a-km-zA-HJ-NP-Z1-9]{25,34})<', content):
    addresses.add(m.group(1))

# Bitcoin bech32 addresses
for m in re.finditer(r'>(bc1[a-z0-9]{39,59})<', content):
    addresses.add(m.group(1))

# Tron addresses
for m in re.finditer(r'>(T[1-9A-HJ-NP-Za-km-z]{33})<', content):
    addresses.add(m.group(1))

sorted_list = sorted(addresses)
print(json.dumps(sorted_list, indent=2))
print(f'Extracted {len(sorted_list)} addresses', file=sys.stderr)
" > "$OUTPUT_FILE"

rm -f "$TEMP_FILE"

COUNT=$(python3 -c "import json; print(len(json.load(open('$OUTPUT_FILE'))))")
echo "[$(date -Iseconds)] OFAC SDN refresh complete: $COUNT sanctioned addresses"

# Signal backend to reload (if running via launchd)
BACKEND_PID=$(lsof -ti :4005 2>/dev/null | head -1)
if [ -n "$BACKEND_PID" ]; then
  # The backend can pick up changes on next request via reloadSanctionedAddresses()
  # For now, just log — a full hot-reload requires the server to watch the file
  echo "[$(date -Iseconds)] Backend PID $BACKEND_PID running. File updated, will be picked up on next server restart."
fi
