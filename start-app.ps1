# Starts the relay and web dev servers in their own windows (so they keep
# running independently of this script) and opens the app in your browser.
$root = $PSScriptRoot

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\relay'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\web'; npm run dev"

Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"
