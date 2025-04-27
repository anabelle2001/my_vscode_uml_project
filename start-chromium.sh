#!/bin/bash
# Script to start Chromium with the remote debugging port enabled (9222)

# --- Configuration ---
# Default Chrome/Chromium debug port
DEBUG_PORT=9222
# Try common paths for Chromium
CHROMIUM_CMD="chromium-browser"
if ! command -v $CHROMIUM_CMD &> /dev/null; then
    CHROMIUM_CMD="chromium" # Another common name
    if ! command -v $CHROMIUM_CMD &> /dev/null; then
        CHROMIUM_CMD="/usr/bin/chromium-browser" # Common Linux path
        if ! command -v $CHROMIUM_CMD &> /dev/null; then
           echo "Error: Could not find chromium or chromium-browser command."
           echo "Please install Chromium or adjust CHROMIUM_CMD in this script."
           exit 1
        fi
    fi
fi
# Optional: Specify a separate user data directory for debugging
# USER_DATA_DIR="$HOME/.config/chromium-debug-profile"
# USER_DATA_ARG="--user-data-dir=$USER_DATA_DIR"
USER_DATA_ARG=""
# --- End Configuration ---

# Check if Chromium is already running with the specified debug port
# Use pgrep with a pattern that's less likely to match unrelated processes
if pgrep -f "$CHROMIUM_CMD.*--remote-debugging-port=$DEBUG_PORT" > /dev/null; then
    echo "Chromium with debugging on port $DEBUG_PORT seems to be running already."
    # Optional: Bring the existing window to the front (requires wmctrl or similar)
    # wmctrl -a "Chromium"
else
    echo "Starting Chromium with debugging enabled on port $DEBUG_PORT..."
    # Add $USER_DATA_ARG if you want to use a specific profile/data dir
    "$CHROMIUM_CMD" --remote-debugging-port=$DEBUG_PORT $USER_DATA_ARG &

    # Wait a moment for Chromium to start
    sleep 3
    echo "Chromium should be starting. If it doesn't appear, check for errors or adjust the CHROMIUM_CMD path."
fi

exit 0
