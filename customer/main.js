/**
 * Zoom Cobrowse SDK - Customer Page (NPM Version)
 * 
 * This example demonstrates how to implement a Customer page using the NPM package
 * with BYOP (Bring Your Own PIN) support.
 * 
 * Key Features:
 * - NPM-based SDK integration
 * - Custom PIN code generation (BYOP mode)
 * - Full session lifecycle management
 * 
 * Architecture:
 * - ZoomCobrowseSDK.init() initializes the SDK
 * - session.start() begins screen sharing with a custom PIN
 * - Event listeners handle session state changes
 * 
 * @see https://developers.zoom.us/docs/cobrowse-sdk/
 */

import { ZoomCobrowseSDK } from '@zoom/cobrowsesdk/customer';

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  /** Token server endpoint for JWT generation */
  TOKEN_SERVER_URL: '../token',
  
  /** Your Cobrowse SDK Key from Zoom Marketplace */
  SDK_KEY: 'YOUR_SDK_KEY_HERE',
  
  /** PIN code length for BYOP mode */
  PIN_LENGTH: 8,
  
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
 * - role_type: 1 (Customer role)
 * - user_id: Unique identifier for the customer
 * - user_name: Display name for the customer
 * - enable_byop: 1 (Required for custom PIN codes)
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
      role: 1 // Customer role
    })
  });
  
  if (!response.ok) {
    throw new Error(`Token fetch failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.token;
}

// =============================================================================
// PIN Code Generation
// =============================================================================

/**
 * Generates a random PIN code for BYOP mode.
 * 
 * PIN code requirements:
 * - Alphanumeric characters only (A-Z, 0-9)
 * - Maximum 10 characters
 * - Will be converted to uppercase automatically
 * 
 * @returns {string} Generated PIN code
 */
function generatePinCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let pin = '';
  for (let i = 0; i < CONFIG.PIN_LENGTH; i++) {
    pin += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pin;
}

// =============================================================================
// Session Management
// =============================================================================

/**
 * Starts a new Cobrowse session.
 * 
 * This method:
 * 1. Fetches SDK token from token server
 * 2. Generates a custom PIN code (BYOP mode)
 * 3. Initializes the SDK
 * 4. Registers event listeners
 * 5. Starts the session with the custom PIN
 * 
 * The customer should share the displayed PIN code with the agent
 * to allow them to join the session.
 * 
 * @returns {Promise<{session: object, pinCode: string}>} Session object and PIN
 * @throws {Error} If initialization or start fails
 * 
 * @example
 * const { pinCode } = await startSession();
 * console.log('Share this PIN with your agent:', pinCode);
 */
async function startSession() {
  console.log('[Customer] Starting session...');
  
  try {
    // Step 1: Fetch SDK token
    const sdkToken = await fetchSdkToken();
    console.log('[Customer] Token received');
    
    // Step 2: Generate custom PIN code
    const pinCode = generatePinCode();
    console.log('[Customer] Generated PIN:', pinCode);
    
    // Step 3: Initialize SDK
    const initResult = await new Promise((resolve, reject) => {
      ZoomCobrowseSDK.init({
        appKey: CONFIG.SDK_KEY
      }, (result) => {
        if (result.success) {
          resolve(result);
        } else {
          reject(result.error || new Error('SDK initialization failed'));
        }
      });
    });
    
    console.log('[Customer] SDK initialized');
    currentSession = initResult.session;
    
    // Step 4: Set up event listeners
    setupEventListeners(currentSession);
    
    // Step 5: Start session with custom PIN
    await new Promise((resolve, reject) => {
      currentSession.start({
        customPinCode: pinCode,
        sdkToken: sdkToken
      }, (result) => {
        if (result.success) {
          resolve(result);
        } else {
          reject(result.error || new Error('Session start failed'));
        }
      });
    });
    
    console.log('[Customer] Session started');
    
    // Display PIN code to user
    displayPinCode(pinCode);
    
    return { session: currentSession, pinCode };
    
  } catch (error) {
    console.error('[Customer] Error:', error);
    updateStatus(`Error: ${error.message || 'Unknown error'}`);
    throw error;
  }
}

/**
 * Ends the current session.
 * Cleans up the session reference after ending.
 */
function endSession() {
  if (!currentSession) {
    console.log('[Customer] No active session');
    return;
  }
  
  console.log('[Customer] Ending session...');
  currentSession.end();
  currentSession = null;
}

// =============================================================================
// Event Handling
// =============================================================================

/**
 * Sets up event listeners for session lifecycle events.
 * 
 * Available events:
 * - session_started: Session successfully started, waiting for agent
 * - session_ended: Session was terminated
 * - session_error: An error occurred
 * - agent_joined: An agent joined the session
 * - agent_left: The agent left the session
 * 
 * @param {object} session - The session object from SDK initialization
 */
function setupEventListeners(session) {
  // Session lifecycle events
  session.on('session_started', () => {
    console.log('[Customer] Event: session_started');
    updateStatus('Session started - waiting for agent');
  });
  
  session.on('session_ended', (payload) => {
    console.log('[Customer] Event: session_ended', payload);
    updateStatus('Session ended');
    currentSession = null;
    hidePinCode();
  });
  
  session.on('session_error', (payload) => {
    console.error('[Customer] Event: session_error', payload);
    updateStatus(`Error: ${payload.errorMsg || 'Unknown error'}`);
  });
  
  // Agent events
  session.on('agent_joined', (payload) => {
    console.log('[Customer] Event: agent_joined', payload);
    updateStatus('Agent joined the session');
  });
  
  session.on('agent_left', (payload) => {
    console.log('[Customer] Event: agent_left', payload);
    updateStatus('Agent left the session');
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
  console.log('[Customer] Status:', message);
}

/**
 * Displays the PIN code in the UI for the customer to share.
 * @param {string} pinCode - The PIN code to display
 */
function displayPinCode(pinCode) {
  const pinDisplay = document.getElementById('pin-display');
  if (pinDisplay) {
    pinDisplay.textContent = pinCode;
    pinDisplay.style.display = 'block';
  }
}

/**
 * Hides the PIN code display.
 * Called when session ends.
 */
function hidePinCode() {
  const pinDisplay = document.getElementById('pin-display');
  if (pinDisplay) {
    pinDisplay.style.display = 'none';
    pinDisplay.textContent = '';
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
 * <button onclick="CobrowseCustomer.startSession()">Start Session</button>
 */
window.CobrowseCustomer = {
  startSession,
  endSession,
  getSession: () => currentSession,
  CONFIG
};

// =============================================================================
// Initialization
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log(`[Customer] Cobrowse Customer SDK Sample v${CONFIG.VERSION}`);
  console.log('[Customer] Mode: NPM with BYOP');
  updateStatus('Ready');
});