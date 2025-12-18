# Quick Start Guide

## Prerequisites

- Node.js 14+ installed
- OpenAI API key
- Modern browser (Chrome, Firefox, Safari, Edge)

## Installation

### 1. Clone & Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-your-actual-key-here
```

## Running the Application

### Option 1: Run Both Servers Together (Recommended)

```bash
npm run dev:full
```

This will start:
- Backend API server on `http://localhost:3001`
- React frontend on `http://localhost:3000`

### Option 2: Run Servers Separately

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run client
```

### Option 3: Use Start Script

```bash
./start-dev.sh
```

## Accessing the Application

Once both servers are running:

1. Open browser and go to `http://localhost:3000`
2. Allow microphone permission when prompted
3. Press and hold the microphone button
4. Wait for countdown (1 second)
5. Speak clearly
6. Release button to send

## Common Issues

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3001`

**Solution:**
```bash
# Find process using port 3001
lsof -i :3001

# Kill the process (replace PID with actual process ID)
kill -9 <PID>

# Restart server
npm run dev
```

### Proxy Error in React

**Error:** `Proxy error: Could not proxy request /api/health`

**Solution:**
1. Make sure backend server is running on port 3001
2. Check `client/package.json` has correct proxy:
   ```json
   "proxy": "http://localhost:3001"
   ```
3. Restart React dev server

### Microphone Not Working

**Solution:**
1. Check browser permissions (usually in address bar)
2. Reload page after granting permission
3. Use HTTPS or localhost (required for microphone access)

### OpenAI API Error

**Solution:**
1. Verify API key in `.env` file
2. Check API key has credits at https://platform.openai.com/
3. Restart backend server after changing `.env`

## Testing

### Test Backend API

```bash
# Health check
curl http://localhost:3001/api/health

# Expected response:
# {"status":"OK","timestamp":"...","openai_configured":true}
```

### Test Frontend

1. Open `http://localhost:3000` in browser
2. Open browser console (F12)
3. Check for any errors
4. Test microphone button

## Production Build

```bash
# Build React app
npm run build

# Set environment to production
export NODE_ENV=production

# Start server
npm start
```

Server will serve React build from `client/build` on port 3001.

## Stopping the Application

### If using npm run dev:full
Press `Ctrl+C` in terminal

### If running separately
Press `Ctrl+C` in each terminal

### Kill all node processes (if needed)
```bash
# macOS/Linux
pkill -f node

# Or find and kill specific processes
ps aux | grep node
kill -9 <PID>
```

## Next Steps

- Read [README.md](./README.md) for detailed documentation
- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues
- Customize AI responses in `server.js`
- Modify UI components in `client/src/components/`

## Support

If you encounter issues:
1. Check browser console for errors
2. Check server terminal for errors
3. Verify all dependencies are installed
4. Ensure ports 3000 and 3001 are available
5. Restart both servers