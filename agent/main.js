/**
 * Zoom Cobrowse SDK - Agent Viewer (NPM Version)
 * 
 * This example demonstrates how to implement an Agent viewer using the NPM package
 * with local rendering (no external Zoom-hosted iframe required).
 * 
 * Key Features:
 * - Local rendering via session.join() - avoids CSP iframe restrictions
 * - BYOP (Bring Your Own PIN) support
 * - Full session lifecycle management
 * 
 * Architecture:
 * - ZoomCobrowseAgentSDK.init() initializes the SDK with zoomAppRoot
 * - session.join() creates a local iframe and renders the viewer
 * - Event listeners handle session state changes
 * 
 * @see https://developers.zoom.us/docs/cobrowse-sdk/
 */

import { ZoomCobrowseAgentSDK } from '@zoom/cobrowsesdk/agent';

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  /** Token server endpoint for JWT generation */
  TOKEN_SERVER_URL: '../token',
  
  /** Your Cobrowse SDK Key from Zoom Marketplace */
  SDK_KEY: 'YOUR_SDK_KEY_HERE',
  
  /** DOM selector where the viewer iframe will be rendered */
  VIEWER_ROOT_SELECTOR: '#viewer-root',
  
  /** Zoom Cobrowse host (default for most regions) */
  ZOOM_HOST: 'us01-zcb.zoom.us',
  
  /** Version identifier for debugging */
  VERSION: '1.0.2',
};

// =============================================================================
// State
// =============================================================================

/** Current active session reference */
let currentSession = null;

// =============================================================================
// Token Management
// =============================================================================

/**
 * Fetches an SDK token (JWT) from the token server.
 * 
 * The token server should generate a JWT with:
 * - app_key: Your SDK key
 * - role_type: 2 (Agent role)
 * - user_id: Unique identifier for the agent
 * - user_name: Display name for the agent
 * 
 * @returns {Promise<string>} The JWT token string
 * @throws {Error} If token fetch fails
 */
async function fetchSdkToken() {
  const response = await fetch(CONFIG.TOKEN_SERVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sdkKey: CONFIG.SDK_KEY,
      role: 2 // Agent role
    })
  });
  
  if (!response.ok) {
    throw new Error(`Token fetch failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.token;
}

// =============================================================================
// Session Management
// =============================================================================

/**
 * Joins a Cobrowse session as an agent.
 * 
 * This method uses the NPM local rendering approach:
 * 1. Fetches SDK token from token server
 * 2. Initializes SDK with zoomAppRoot (required for local rendering)
 * 3. Registers event listeners
 * 4. Calls session.join() to render viewer locally
 * 
 * Note: This differs from createAgentViewerEndpoint() which returns a 
 * Zoom-hosted URL requiring CSP modifications.
 * 
 * @param {string} pinCode - 8-character PIN code from the customer
 * @returns {Promise<void>}
 * @throws {Error} If initialization or join fails
 * 
 * @example
 * await joinSession('ABCD1234');
 */
async function joinSession(pinCode) {
  console.log('[Agent] Joining session with PIN:', pinCode);
  
  try {
    // Step 1: Fetch SDK token
    const sdkToken = await fetchSdkToken();
    console.log('[Agent] Token received');
    
    // Step 2: Initialize SDK
    // IMPORTANT: zoomAppRoot is required for NPM local rendering mode
    const initResult = await new Promise((resolve, reject) => {
      ZoomCobrowseAgentSDK.init({
        appKey: CONFIG.SDK_KEY,
        zoomAppRoot: CONFIG.VIEWER_ROOT_SELECTOR,
        zoomHostName: CONFIG.ZOOM_HOST
      }, ({ success, sdkInfo, session, error }) => {
        if (success) {
          resolve({ success, sdkInfo, session });
        } else {
          reject(error || new Error('SDK initialization failed'));
        }
      });
    });
    
    console.log('[Agent] SDK initialized');
    currentSession = initResult.session;
    
    // Step 3: Set up event listeners before joining
    setupEventListeners(currentSession);
    
    // Step 4: Clear any placeholder content
    clearViewerPlaceholder();
    
    // Step 5: Join session
    // join() renders the viewer locally within zoomAppRoot
    currentSession.join({
      pinCode: pinCode,
      sdkToken: sdkToken
    }, ({ success, error }) => {
      if (success) {
        console.log('[Agent] Join successful');
        updateStatus('Joined session');
      } else {
        console.error('[Agent] Join failed:', error);
        updateStatus(`Join failed: ${error?.errorMsg || 'Unknown error'}`);
      }
    });
    
  } catch (error) {
    console.error('[Agent] Error:', error);
    updateStatus(`Error: ${error.message || 'Unknown error'}`);
    throw error;
  }
}

/**
 * Leaves the current session.
 * Cleans up the session reference after leaving.
 */
function leaveSession() {
  if (!currentSession) {
    console.log('[Agent] No active session');
    return;
  }
  
  console.log('[Agent] Leaving session...');
  
  if (typeof currentSession.leave === 'function') {
    currentSession.leave();
  } else if (typeof currentSession.end === 'function') {
    currentSession.end();
  }
  
  currentSession = null;
}

// =============================================================================
// Event Handling
// =============================================================================

/**
 * Sets up event listeners for session lifecycle events.
 * 
 * Available events:
 * - session_joined: Agent successfully joined the session
 * - session_left: Agent left the session
 * - session_ended: Session was terminated
 * - session_error: An error occurred
 * - customer_focus_lost: Customer switched tabs/windows
 * - customer_transferred: Customer was transferred to another agent
 * 
 * @param {object} session - The session object from SDK initialization
 */
function setupEventListeners(session) {
  // Session lifecycle events
  session.on('session_joined', (payload) => {
    console.log('[Agent] Event: session_joined', payload);
    updateStatus('Connected to customer');
  });
  
  session.on('session_left', (payload) => {
    console.log('[Agent] Event: session_left', payload);
    updateStatus('Left session');
    currentSession = null;
  });
  
  session.on('session_ended', (payload) => {
    console.log('[Agent] Event: session_ended', payload);
    updateStatus('Session ended');
    currentSession = null;
  });
  
  session.on('session_error', (payload) => {
    console.error('[Agent] Event: session_error', payload);
    updateStatus(`Error: ${payload.errorMsg || 'Unknown error'}`);
  });
  
  // Customer events
  session.on('customer_focus_lost', (payload) => {
    console.log('[Agent] Event: customer_focus_lost', payload);
  });
  
  session.on('customer_transferred', (payload) => {
    console.log('[Agent] Event: customer_transferred', payload);
  });
}

// =============================================================================
// UI Helpers
// =============================================================================

/**
 * Updates the status display in the UI.
 * @param {string} message - Status message to display
 */
function updateStatus(message) {
  const statusEl = document.getElementById('status');
  if (statusEl) {
    statusEl.textContent = message;
  }
  console.log('[Agent] Status:', message);
}

/**
 * Clears the placeholder content from the viewer root.
 * Called before join() to ensure clean rendering.
 */
function clearViewerPlaceholder() {
  const placeholder = document.querySelector('.viewer-placeholder');
  if (placeholder) {
    placeholder.remove();
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Exposed API for use in HTML event handlers.
 * 
 * @example
 * // In HTML:
 * <button onclick="CobrowseAgent.joinSession('ABCD1234')">Join</button>
 */
window.CobrowseAgent = {
  joinSession,
  getSession: () => currentSession,
  CONFIG
};

// =============================================================================
// Initialization
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log(`[Agent] Cobrowse Agent SDK Sample v${CONFIG.VERSION}`);
  console.log('[Agent] Mode: NPM local rendering');
  updateStatus('Ready');
});