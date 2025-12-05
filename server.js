/**
 * Combined Server for Cloud Run
 * 
 * Serves both static files and token API on a single port.
 * Cloud Run provides the PORT environment variable.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============================================
// CONFIGURATION
// ============================================
const PORT = process.env.PORT || 8080;
const ROOT_DIR = __dirname;

// SDK credentials from environment variables
const CONFIG = {
  SDK_KEY: process.env.SDK_KEY || 'YOUR_SDK_KEY_HERE',
  SDK_SECRET: process.env.SDK_SECRET || 'YOUR_SDK_SECRET_HERE',
  TOKEN_EXPIRY: 3600,
  ZOOM_DOMAIN: 'us01-zcb.zoom.us'
};

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json'
};

// ============================================
// TOKEN GENERATION
// ============================================
function generateToken(sdkKey, sdkSecret, role = 1) {
  console.log(`Generating token with SDK Key: ${sdkKey}`);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + CONFIG.TOKEN_EXPIRY;
  const uniqueId = `user_${Date.now()}`;
  
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    app_key: sdkKey,
    role_type: role,
    iat: now,
    exp: exp,
    user_id: uniqueId,        // Required
    user_name: uniqueId,      // Required
    enable_byop: 1            // Required for BYOP mode
  };
  
  const base64url = (obj) => {
    const json = JSON.stringify(obj);
    const base64 = Buffer.from(json).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };
  
  const headerEncoded = base64url(header);
  const payloadEncoded = base64url(payload);
  const signatureInput = `${headerEncoded}.${payloadEncoded}`;
  
  const signature = crypto
    .createHmac('sha256', sdkSecret)
    .update(signatureInput)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

// ============================================
// REQUEST HANDLING
// ============================================
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
      return;
    }
    
    res.writeHead(200, { 
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600'
    });
    res.end(data);
  });
}

async function handleTokenRequest(req, res, url) {
  res.setHeader('Content-Type', 'application/json');
  
  try {
    let role = 1; // Default to customer role
    
    if (req.method === 'POST') {
      const body = await parseBody(req);
      console.log('Token request body:', body);
      role = body.role || role;
    }
    
    if (CONFIG.SDK_KEY === 'YOUR_SDK_KEY_HERE' || CONFIG.SDK_SECRET === 'YOUR_SDK_SECRET_HERE') {
      res.writeHead(500);
      res.end(JSON.stringify({
        error: 'SDK_KEY and SDK_SECRET environment variables must be set'
      }));
      return;
    }
    
    const token = generateToken(CONFIG.SDK_KEY, CONFIG.SDK_SECRET, role);
    
    console.log(`[${new Date().toISOString()}] Token generated for role: ${role}`);
    
    res.writeHead(200);
    res.end(JSON.stringify({
      token: token,
      role: role,
      expiresIn: CONFIG.TOKEN_EXPIRY,
      domain: CONFIG.ZOOM_DOMAIN
    }));
    
  } catch (error) {
    console.error('Token generation error:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: error.message }));
  }
}

// ============================================
// HTTP SERVER
// ============================================
const server = http.createServer(async (req, res) => {
  // CORS headers
  //res.setHeader('Access-Control-Allow-Origin', '*');
  //res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  //res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  
  console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);
  
  // API Routes
  if (pathname === '/token') {
    await handleTokenRequest(req, res, url);
    return;
  }
  
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  
  // Static file routes
  let filePath;
  
  if (pathname === '/' || pathname === '/customer' || pathname === '/customer/') {
    filePath = path.join(ROOT_DIR, 'customer', 'index.html');
  } else if (pathname === '/agent' || pathname === '/agent/') {
    filePath = path.join(ROOT_DIR, 'agent', 'index.html');
  } else if (pathname.startsWith('/dist/')) {
    filePath = path.join(ROOT_DIR, pathname);
  } else {
    filePath = path.join(ROOT_DIR, pathname);
  }
  
  // Security check
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }
  
  // Check if directory and serve index.html
  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    serveFile(res, filePath);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║        Cobrowse SDK Demo - Cloud Run Server                  ║
╠══════════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                                  ║
║                                                              ║
║  Pages:                                                      ║
║    /customer  - Customer page                                ║
║    /agent     - Agent viewer                                 ║
║                                                              ║
║  API:                                                        ║
║    /token     - Get SDK token                                ║
║    /health    - Health check                                 ║
║                                                              ║
║  Environment:                                                ║
║    SDK_KEY:    ${CONFIG.SDK_KEY === 'YOUR_SDK_KEY_HERE' ? '(not set)' : 'configured'}                                   ║
║    SDK_SECRET: ${CONFIG.SDK_SECRET === 'YOUR_SDK_SECRET_HERE' ? '(not set)' : 'configured'}                                   ║
╚══════════════════════════════════════════════════════════════╝
  `);
});
