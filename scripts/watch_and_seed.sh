#!/bin/bash
# Watch for GIF download to complete, extract, and run seed.
# This script polls until the .crdownload file disappears,
# then finds the new GIF tar, extracts 360x360 GIFs, and seeds Firestore.

DOWNLOADS="/c/Users/Leonard/Downloads"
DATA_DIR="/c/Users/Leonard/Documents/Business/Flexen/flexenapp/scripts/exercisedb-data"
SCRIPTS_DIR="/c/Users/Leonard/Documents/Business/Flexen/flexenapp/scripts"

echo "=== ExerciseDB Auto-Seed Watcher ==="
echo "Watching for GIF download to complete..."
echo ""

# Step 1: Wait for .crdownload files to disappear
while true; do
  CRDOWNLOADS=$(ls "$DOWNLOADS"/*.crdownload 2>/dev/null | wc -l)
  if [ "$CRDOWNLOADS" -eq 0 ]; then
    echo "[$(date +%H:%M:%S)] No .crdownload files found — downloads appear complete!"
    break
  fi
  # Show download progress
  for f in "$DOWNLOADS"/*.crdownload; do
    SIZE=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f" 2>/dev/null)
    SIZE_MB=$((SIZE / 1024 / 1024))
    echo -ne "\r[$(date +%H:%M:%S)] Still downloading... (${SIZE_MB} MB)   "
  done
  sleep 15
done

echo ""

# Step 2: Find the GIF tar file (look for new tar files with "gif" or large ones)
echo "Looking for GIF tar file..."
GIF_TAR=""

# Check for files matching common patterns
for pattern in "gifs_360x360" "gifs_720" "gifs_180" "gif"; do
  FOUND=$(ls -t "$DOWNLOADS"/*.tar 2>/dev/null | while read f; do
    tar -tf "$f" 2>/dev/null | head -5 | grep -qi "$pattern" && echo "$f" && break
  done)
  if [ -n "$FOUND" ]; then
    GIF_TAR="$FOUND"
    echo "Found GIF tar: $GIF_TAR"
    break
  fi
done

# Fallback: find the newest large tar file
if [ -z "$GIF_TAR" ]; then
  GIF_TAR=$(ls -tS "$DOWNLOADS"/*.tar 2>/dev/null | head -1)
  echo "Using largest/newest tar: $GIF_TAR"
fi

if [ -z "$GIF_TAR" ]; then
  echo "ERROR: No GIF tar file found in $DOWNLOADS"
  exit 1
fi

# Step 3: Check what resolutions are in the tar
echo ""
echo "Checking tar contents..."
RESOLUTIONS=$(tar -tf "$GIF_TAR" 2>/dev/null | grep -oE "gifs_[0-9]+x[0-9]+" | sort -u)
echo "Available resolutions: $RESOLUTIONS"

# Prefer 360x360, fallback to whatever is available
TARGET_RES="gifs_360x360"
if ! echo "$RESOLUTIONS" | grep -q "gifs_360x360"; then
  TARGET_RES=$(echo "$RESOLUTIONS" | head -1)
  echo "360x360 not found, using: $TARGET_RES"
fi

# Step 4: Extract GIFs
echo ""
echo "Extracting $TARGET_RES to $DATA_DIR/gifs_360x360/..."
mkdir -p "$DATA_DIR/gifs_360x360"

# Extract the target resolution, stripping the folder prefix
tar -xf "$GIF_TAR" --wildcards "*/$TARGET_RES/*.gif" --strip-components=1 -C "$DATA_DIR/" 2>/dev/null

# If the extracted folder name differs from gifs_360x360, rename it
if [ "$TARGET_RES" != "gifs_360x360" ] && [ -d "$DATA_DIR/$TARGET_RES" ]; then
  mv "$DATA_DIR/$TARGET_RES"/* "$DATA_DIR/gifs_360x360/" 2>/dev/null
  rmdir "$DATA_DIR/$TARGET_RES" 2>/dev/null
fi

GIF_COUNT=$(ls "$DATA_DIR/gifs_360x360/"*.gif 2>/dev/null | wc -l)
echo "Extracted $GIF_COUNT GIF files."

if [ "$GIF_COUNT" -eq 0 ]; then
  echo "ERROR: No GIFs extracted. Trying alternate extraction..."
  # Try extracting all .gif files
  tar -xf "$GIF_TAR" -C "$DATA_DIR/" 2>/dev/null
  # Find and move GIFs
  find "$DATA_DIR" -name "*.gif" -not -path "*/gifs_360x360/*" -exec mv {} "$DATA_DIR/gifs_360x360/" \; 2>/dev/null
  GIF_COUNT=$(ls "$DATA_DIR/gifs_360x360/"*.gif 2>/dev/null | wc -l)
  echo "After fallback extraction: $GIF_COUNT GIF files."
fi

if [ "$GIF_COUNT" -eq 0 ]; then
  echo "ERROR: Still no GIFs. Running seed without GIFs..."
  cd "$SCRIPTS_DIR" && node seed_exercises.js --skip-gifs
  exit $?
fi

# Step 5: Run the seed script
echo ""
echo "=== Starting Firestore + Firebase Storage seed ==="
echo "This will upload $GIF_COUNT GIFs and 1500 exercise docs..."
echo ""
cd "$SCRIPTS_DIR" && node seed_exercises.js

echo ""
echo "=== Done! ==="
