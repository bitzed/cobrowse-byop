> ⚠️ The following sample application is a personal, open-source project shared by the app creator and not an officially supported Zoom Communications, Inc. sample application. Zoom Communications, Inc., its employees and affiliates are not responsible for the use and maintenance of this application. Please use this sample application for inspiration, exploration and experimentation at your own risk and enjoyment. You may reach out to the app creator and broader Zoom Developer community on https://devforum.zoom.us/ for technical discussion and assistance, but understand there is no service level agreement support for this application. Thank you and happy coding!

> ⚠️ このサンプルのアプリケーションは、Zoom Communications, Inc.の公式にサポートされているものではなく、アプリ作成者が個人的に公開しているオープンソースプロジェクトです。Zoom Communications, Inc.とその従業員、および関連会社は、本アプリケーションの使用や保守について責任を負いません。このサンプルアプリケーションは、あくまでもインスピレーション、探求、実験のためのものとして、ご自身の責任と楽しみの範囲でご活用ください。技術的な議論やサポートが必要な場合は、アプリ作成者やZoom開発者コミュニティ（ https://devforum.zoom.us/ ）にご連絡いただけますが、このアプリケーションにはサービスレベル契約に基づくサポートがないことをご理解ください。

# Zoom Cobrowse SDK - NPM Sample

This sample demonstrates using the Zoom Cobrowse SDK via npm package with **local rendering** for the Agent Viewer. This approach avoids CSP issues because the viewer renders within your domain instead of loading from Zoom's servers.

## Architecture Comparison

### CDN Version (External Iframe)
```
Agent Page → createAgentViewerEndpoint() → Returns Zoom URL
                                                ↓
                                    iframe.src = "https://us01-zcb.zoom.us/..."
                                                ↓
                              Target Page needs CSP: frame-ancestors *.zoom.us
```

### NPM Version (Local Render) ✅
```
Agent Page → session.join() → SDK creates iframe internally
                                    ↓
                          Viewer renders on YOUR domain
                                    ↓
                          No CSP changes needed!
```

## Key Differences

| Feature | CDN Version | NPM Version |
|---------|-------------|-------------|
| Agent Viewer Location | Zoom servers (`us01-zcb.zoom.us`) | Your domain |
| CSP Requirements | Target needs `frame-ancestors` with Zoom | None |
| Join Method | `createAgentViewerEndpoint()` → URL | `session.join()` → local render |
| Init Parameter | – | `appKey` in init |
| Bundle Size | Smaller (loads from CDN) | Larger (includes viewer) |

## Setup

### 1. Install dependencies
```bash
bun install
```

### 2. Configure credentials

Set environment variables:
```bash
export SDK_KEY="your_sdk_key"
export SDK_SECRET="your_sdk_secret"
```

Or edit `server.js` directly:
```javascript
const CONFIG = {
  SDK_KEY: 'YOUR_SDK_KEY_HERE',
  SDK_SECRET: 'YOUR_SDK_SECRET_HERE',
  // ...
};
```

Also update `customer/main.js` and `agent/main.js`:
```javascript
const SDK_KEY = 'YOUR_SDK_KEY_HERE';
```

### 3. Build the bundles
```bash
bun run build
```

This creates:
- `dist/customer.js` - Customer SDK bundle
- `dist/agent.js` - Agent SDK bundle (includes viewer!)

### 4. Start the server
```bash
bun run dev
# or
node server.js
```

Server runs on port 8080 (or `PORT` env variable).

### 5. Open in browser

- **Customer**: http://localhost:8080/customer
- **Agent**: http://localhost:8080/agent

## Usage Flow

1. **Customer** clicks "Start Session"
2. Customer receives a PIN code (e.g., `ABC12345`)
3. **Agent** enters the PIN code and clicks "Join Session"
4. Agent viewer shows the customer's screen
5. Agent can use "Start Remote Assist" to request control

## NPM Mode: Key Code Patterns

### Customer SDK
```javascript
import ZoomCobrowseSDK from '@zoom/cobrowsesdk';

// Initialize with appKey (not sdkToken!)
ZoomCobrowseSDK.init({ appKey: SDK_KEY }, (session) => {
  // Generate custom PIN (BYOP)
  const pinCode = generatePinCode(); // 8 chars, A-Z0-9
  
  // Start session
  session.start({
    customPinCode: pinCode,
    sdkToken: sdkToken  // From your token server
  }, callback);
});
```

### Agent SDK
```javascript
import ZoomCobrowseAgentSDK from '@zoom/cobrowsesdk/agent';

// Initialize with zoomAppRoot for local rendering
ZoomCobrowseAgentSDK.init({
  appKey: SDK_KEY,
  zoomAppRoot: '#viewer-root',  // Required for NPM mode!
  zoomHostName: 'us01-zcb.zoom.us'
}, (session) => {
  // Join session - renders locally, no URL returned
  session.join({
    pinCode: pinCode,
    sdkToken: sdkToken
  }, callback);
});
```

### CDN vs NPM Comparison
```javascript
// ❌ CDN approach - requires CSP changes on target
const endpoint = await session.createAgentViewerEndpoint({ pinCode, sdkToken });
iframe.src = endpoint.agentViewerUrl; // Loads from Zoom servers!

// ✅ NPM approach - no CSP changes needed
session.join({ pinCode, sdkToken }, callback); // Renders locally!
```

## Project Structure
```
cobrowse-npm-sample/
├── customer/
│   ├── index.html        # Customer page
│   └── main.js           # Customer SDK initialization
├── agent/
│   ├── index.html        # Agent viewer page
│   └── main.js           # Agent SDK with local rendering
├── dist/
│   ├── customer.js       # Bundled customer SDK
│   └── agent.js          # Bundled agent SDK (includes viewer!)
├── server.js             # Combined static + token server
├── package.json
└── README.md
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/customer` | GET | Customer page |
| `/agent` | GET | Agent viewer page |
| `/token` | POST | Generate SDK token |
| `/health` | GET | Health check |

### Token API
```bash
# Get customer token (role=1)
curl -X POST http://localhost:8080/token -H "Content-Type: application/json" -d '{"role": 1}'

# Get agent token (role=2)
curl -X POST http://localhost:8080/token -H "Content-Type: application/json" -d '{"role": 2}'
```

## Troubleshooting

### "SDK not loaded"
Make sure you ran `bun run build` first.

### Token errors
Check that `SDK_KEY` and `SDK_SECRET` are correctly configured.

### Agent viewer shows loading spinner
- Ensure Customer has started a session first
- Check that PIN code is correct (8 characters, uppercase)
- Verify both Customer and Agent are using the same SDK_KEY

### CORS errors
Make sure all pages are served from the same origin.

## Important Notes

- **Customer page should not contain iframes** - The SDK captures the page content directly
- **zoomAppRoot is required** for NPM mode Agent viewer
- **role_type must be numeric** in JWT token (1 for customer, 2 for agent)

## License

This sample is provided as-is for demonstration purposes.