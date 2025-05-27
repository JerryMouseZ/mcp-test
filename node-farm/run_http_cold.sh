#!/bin/bash
cd /app/node-farm || exit 1 # Ensure we are in the correct directory

# Start the server in the background and get its PID
node mcp_server_http.js &
SERVER_PID=$!

# Wait for the server to start (adjust sleep time if needed)
sleep 0.2 # Increased sleep time slightly

# Execute the client
node client.js --mode http --action uppercase --payload "performance test"

# Kill the server
kill $SERVER_PID

# Wait for the server process to be fully terminated to avoid EADDRINUSE
wait $SERVER_PID 2>/dev/null
sleep 0.1
