#!/bin/bash
# Script to start Firefox with the remote debugging port enabled (6000)

# --- Configuration ---
# Adjust the port if 6000 is already in use
DEBUG_PORT=6000
# Try common paths for Firefox
FIREFOX_CMD="firefox"
if ! command -v $FIREFOX_CMD &> /dev/null; then
    FIREFOX_CMD="/usr/bin/firefox" # Common Linux path
    if ! command -v $FIREFOX_CMD &> /dev/null; then
       echo "Error: Could not find firefox command. Please install Firefox or adjust FIREFOX_CMD in this script."
       exit 1
    fi
fi
# Optional: Specify a dedicated profile for debugging
# PROFILE_PATH="$HOME/.mozilla/firefox/dev-profile" 
# PROFILE_ARG="--profile $PROFILE_PATH"
PROFILE_ARG="" 
# --- End Configuration ---

# Check if Firefox is already running with the specified debug port
if pgrep -f "$FIREFOX_CMD.*--start-debugger-server $DEBUG_PORT" > /dev/null; then
    echo "Firefox with debugging on port $DEBUG_PORT seems to be running already."
    # Optional: Bring the existing window to the front (requires wmctrl or similar)
    # wmctrl -a "Mozilla Firefox"
else
    echo "Starting Firefox with debugging enabled on port $DEBUG_PORT..."
    # Use --new-instance to try and force a new process if one is already running without the debugger
    # Add $PROFILE_ARG if you want to use a specific profile
    "$FIREFOX_CMD" --start-debugger-server $DEBUG_PORT --new-instance $PROFILE_ARG &
    
    # Wait a moment for Firefox to start
    sleep 3 
    echo "Firefox should be starting. If it doesn't appear, check for errors or adjust the FIREFOX_CMD path."
fi

exit 0
