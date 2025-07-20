#!/bin/bash

# Load Node.js
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use node

# Start the development server in the background
echo "Starting Next.js development server..."
npm run dev &
DEV_PID=$!

# Wait for the server to start
echo "Waiting for server to start..."
sleep 15

# Test if server is running
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ Development server is running on http://localhost:3000"
    
    # Start ngrok
    echo "Starting ngrok..."
    npx ngrok http 3000 &
    NGROK_PID=$!
    
    # Wait for ngrok to start
    sleep 10
    
    # Get the ngrok URL
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ ! -z "$NGROK_URL" ]; then
        echo "✅ Ngrok is running on: $NGROK_URL"
        echo "🎉 Your app is accessible at: $NGROK_URL"
    else
        echo "❌ Failed to get ngrok URL"
    fi
    
    # Keep the script running
    echo "Services are running. Press Ctrl+C to stop."
    wait
else
    echo "❌ Failed to start development server"
    exit 1
fi 