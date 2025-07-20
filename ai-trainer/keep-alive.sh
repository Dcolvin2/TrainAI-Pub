#!/bin/bash

# Load Node.js
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use node

echo "🚀 Starting services with keep-alive..."

# Function to start development server
start_dev_server() {
    echo "Starting Next.js development server..."
    npm run dev
}

# Function to start ngrok
start_ngrok() {
    echo "Starting ngrok tunnel..."
    npx ngrok http 3000
}

# Start both services in parallel
start_dev_server &
DEV_PID=$!

# Wait a bit for the server to start
sleep 10

# Check if server is running
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Development server is running"
    start_ngrok &
    NGROK_PID=$!
    
    # Wait for ngrok to start
    sleep 5
    
    # Get ngrok URL
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ ! -z "$NGROK_URL" ]; then
        echo "✅ Ngrok is running on: $NGROK_URL"
        echo "🎉 Your app is accessible at: $NGROK_URL"
    fi
    
    # Keep both processes running
    wait
else
    echo "❌ Failed to start development server"
    exit 1
fi 