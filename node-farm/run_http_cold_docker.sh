#!/bin/bash
# Ensure running from node-farm directory or adjust paths
cd /app/node-farm || exit 1

# Start container, get ID
# Using sudo for docker commands as per previous successful docker interactions
CONTAINER_ID=$(sudo docker run -d -p 3000:3000 mcp_server_http_image:latest)

# Give server a moment to start
sleep 0.5 # May need adjustment

# Run client against containerized server
node client.js --mode http --action uppercase --payload "docker http cold"

# Stop and remove container
sudo docker stop $CONTAINER_ID > /dev/null
sudo docker rm $CONTAINER_ID > /dev/null
sleep 0.1 # Brief pause to ensure port is free
