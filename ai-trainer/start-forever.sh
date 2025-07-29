#!/bin/bash

# Load Node.js
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use node

echo "🚀 Starting services with keep-alive..."

# Function to start development server
start_dev_server() {
    echo "Starting Next.js development server..."
    while true; do
        npm run dev
        echo "Development server stopped, restarting in 5 seconds..."
        sleep 5
    done
}

# Function to start ngrok
start_ngrok() {
    echo "Starting ngrok tunnel..."
    while true; do
        npx ngrok http 3000
        echo "Ngrok stopped, restarting in 5 seconds..."
        sleep 5
    done
}

# Start development server in background
start_dev_server &
DEV_PID=$!

# Wait for server to start
echo "Waiting for server to start..."
sleep 15

# Check if server is running
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Development server is running"
    
    # Start ngrok in background
    start_ngrok &
    NGROK_PID=$!
    
    # Wait for ngrok to start
    sleep 10
    
    # Get ngrok URL
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ ! -z "$NGROK_URL" ]; then
        echo "✅ Ngrok is running on: $NGROK_URL"
        echo "🎉 Your app is accessible at: $NGROK_URL"
        echo "📝 Update your Supabase settings with this URL"
    else
        echo "❌ Failed to get ngrok URL"
    fi
    
    # Keep both processes running
    wait
else
    echo "❌ Failed to start development server"
    exit 1
fi 