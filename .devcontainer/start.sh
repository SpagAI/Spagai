#!/usr/bin/env bash
# Runs each time you open the codespace: starts the website if it is not already running.
if (echo > /dev/tcp/127.0.0.1/3000) >/dev/null 2>&1; then
  echo "Spag AI Studio is already running. Open the Ports tab and click the globe next to port 3000."
  exit 0
fi
echo ""
echo "Starting Spag AI Studio..."
echo "When it says Ready, a browser tab opens. Sign in as demo@spagai.local"
echo ""
pnpm dev
