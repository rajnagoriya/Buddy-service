/**
 * Single place where a realtime Socket.IO client is built.
 *
 * Before this, the URL-normalisation + connection-options block was copy-pasted into every
 * notification hook and had already drifted: the restaurant hook was polling-only, used a
 * different localhost-blocking rule, and had no resync. Fixes landed in one copy and not the
 * others. The hooks now own only their event handlers; everything about *the connection* lives
 * here.
 *
 * What this adds beyond `io(url, opts)`:
 *   - one URL resolver (API base → socket origin), with the production-localhost guard
 *   - auth recovery: an expired access token used to produce an infinite unrecoverable
 *     reconnect loop, because the token was read once at construction and only refreshed if an
 *     `authRefreshed` window event happened to fire. We now detect AUTH_* handshake failures,
 *     refresh through the existing axios refresh flow, and retry.
 */

import io from 'socket.io-client';
import { refreshModuleAccessToken } from '@food/api/axios';

/** Handshake errors from Backend/src/config/socket.js that mean "the token is the problem". */
const AUTH_ERROR_MESSAGES = new Set(['AUTH_MISSING', 'AUTH_INVALID']);

/** Give up refreshing after this many consecutive auth failures and ask for a re-login. */
const MAX_AUTH_RECOVERY_ATTEMPTS = 3;

const DEFAULT_SOCKET_OPTIONS = {
  path: '/socket.io/',
  // Polling first so the handshake still succeeds behind proxies that block WS upgrade,
  // then upgrade. Never polling-only.
  transports: ['polling', 'websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  timeout: 20000,
};

/**
 * Read the access token for a module, falling back to the legacy shared key.
 * @param {string} module - 'delivery' | 'restaurant' | 'user'
 * @returns {string} token, or '' when absent
 */
export function readModuleToken(module) {
  try {
    return (
      localStorage.getItem(`${module}_accessToken`) ||
      localStorage.getItem('accessToken') ||
      ''
    );
  } catch {
    return '';
  }
}

/**
 * Resolve the Socket.IO origin from the API base URL.
 *
 * The API base is typically `https://host/api/v1`, but Socket.IO is served from the origin.
 * Returns a reason instead of throwing so callers can stay silent in UI-only builds.
 *
 * @param {string} apiBaseUrl
 * @returns {{ origin: string|null, reason: string|null }}
 */
export function resolveSocketOrigin(apiBaseUrl) {
  let raw = String(apiBaseUrl || '').trim();
  if (!raw) return { origin: null, reason: 'API_BASE_URL is empty (UI-only mode)' };

  // Repair malformed protocol prefixes before parsing. `https://https://host` is a real
  // misconfiguration that has shown up in this codebase, and `new URL()` happily accepts it —
  // resolving to origin `https://https`, which then fails to connect with no useful error.
  raw = raw
    .replace(/^(https?):\/+/i, '$1://')          // https:/host, https:///host
    .replace(/^(https?):\/\/(https?):\/\//i, '$2://'); // https://http://host

  let origin = raw;
  try {
    const base =
      raw.startsWith('http')
        ? undefined
        : (typeof window !== 'undefined' ? window.location.origin : undefined);
    origin = new URL(raw, base).origin;
  } catch {
    // Best-effort fallback: strip the API path suffixes and normalise the protocol slashes.
    origin = raw
      .replace(/\/api\/v\d+\/?$/i, '')
      .replace(/\/api\/?$/i, '')
      .replace(/\/+$/, '')
      .replace(/^(https?):\/+/i, '$1://');

    if ((!origin || !origin.startsWith('http')) && typeof window !== 'undefined') {
      origin = window.location.origin;
    }
  }

  if (!origin || !origin.startsWith('http')) {
    return { origin: null, reason: `Invalid backend URL: ${raw}` };
  }

  // Never let a production build dial localhost — it always fails and buries the real cause
  // under a reconnect loop. Allowed when the page itself is served from localhost (dev).
  const backendIsLocalhost = /(^|\/\/)(localhost|127\.0\.0\.1)(:|\/|$)/i.test(origin);
  if (backendIsLocalhost && typeof window !== 'undefined') {
    const host = window.location.hostname;
    const frontendIsLocal = host === 'localhost' || host === '127.0.0.1' || host === '';
    if (!frontendIsLocal) {
      return {
        origin: null,
        reason: `Refusing to connect to ${origin} from ${host} — backend URL is localhost in a deployed build`,
      };
    }
  }

  try {
    // Final validation; throws on a malformed URL.
    void new URL(origin).href;
  } catch (err) {
    return { origin: null, reason: `Invalid Socket.IO URL ${origin}: ${err.message}` };
  }

  return { origin, reason: null };
}

/**
 * Build a realtime socket for a module.
 *
 * Deliberately takes no user/partner id: the server decodes identity from the JWT in the
 * handshake and auto-joins the role room, so the connection must never be gated on (or torn
 * down by) a client-side id that resolves asynchronously.
 *
 * @param {object} params
 * @param {string} params.apiBaseUrl
 * @param {string} params.module            - 'delivery' | 'restaurant' | 'user'
 * @param {(...a:any[])=>void} [params.log]
 * @param {(...a:any[])=>void} [params.warn]
 * @param {() => void} [params.onAuthFatal] - refresh exhausted; app should prompt re-login
 * @returns {{ socket: import('socket.io-client').Socket, destroy: () => void } | null}
 */
export function createRealtimeSocket({
  apiBaseUrl,
  module,
  log = () => {},
  warn = () => {},
  onAuthFatal,
} = {}) {
  const { origin, reason } = resolveSocketOrigin(apiBaseUrl);
  if (!origin) {
    warn(`Socket not created: ${reason}`);
    return null;
  }

  const token = readModuleToken(module);
  const socket = io(origin, {
    ...DEFAULT_SOCKET_OPTIONS,
    auth: { token },
    // The backend also accepts a query token; keep it for handshake compatibility. `auth` is
    // read first server-side, so a stale query token can never win over a refreshed one.
    query: token ? { token } : undefined,
  });

  log('Socket created', { origin, module, tokenPresent: Boolean(token) });

  let authRecoveryAttempts = 0;
  let recovering = false;
  let destroyed = false;

  /** Point the socket at a new token. Applies on the next connection attempt. */
  const applyToken = (nextToken) => {
    if (!nextToken) return;
    socket.auth = { ...(socket.auth || {}), token: nextToken };
    if (socket.io?.opts?.query) socket.io.opts.query.token = nextToken;
  };

  /**
   * Reconnect only when Socket.IO is not already going to. `socket.active` is true while a
   * reconnection cycle is pending — calling connect() then would open a second connection.
   */
  const reconnectIfIdle = () => {
    if (destroyed) return;
    if (socket.connected) return;
    if (socket.active) return; // built-in backoff will retry with the token we just set
    socket.connect();
  };

  const handleConnect = () => {
    authRecoveryAttempts = 0;
  };

  const handleConnectError = async (error) => {
    const message = String(error?.message || '');
    if (!AUTH_ERROR_MESSAGES.has(message)) return; // transport error — leave the backoff alone
    if (destroyed || recovering) return;

    if (authRecoveryAttempts >= MAX_AUTH_RECOVERY_ATTEMPTS) {
      warn(`Auth recovery exhausted after ${authRecoveryAttempts} attempts; stopping reconnects.`);
      // Stop the infinite loop rather than hammering the server with a token that will
      // never be accepted.
      socket.disconnect();
      onAuthFatal?.();
      return;
    }

    recovering = true;
    authRecoveryAttempts += 1;
    try {
      log(`Handshake rejected (${message}); refreshing token`, { attempt: authRecoveryAttempts });
      // Shared with the axios 401 path: de-duplicates concurrent refreshes and distinguishes
      // a transient network failure from a definitively invalid refresh token.
      const nextToken = await refreshModuleAccessToken(module);
      if (nextToken) {
        applyToken(nextToken);
        reconnectIfIdle();
      } else {
        warn('Token refresh returned no token; leaving reconnect backoff in place.');
      }
    } catch (err) {
      warn(`Token refresh failed: ${err?.message || err}`);
    } finally {
      recovering = false;
    }
  };

  /** Another part of the app refreshed the token — adopt it. */
  const handleAuthRefreshed = (event) => {
    const detail = event?.detail || {};
    if (detail.module && detail.module !== module) return;
    if (!detail.token) return;
    log('Adopting refreshed token from authRefreshed event');
    applyToken(detail.token);
    authRecoveryAttempts = 0;
    reconnectIfIdle();
  };

  /** Login/logout in this tab — re-read from storage. */
  const handleAuthChanged = () => {
    const nextToken = readModuleToken(module);
    if (!nextToken) return;
    applyToken(nextToken);
    authRecoveryAttempts = 0;
    reconnectIfIdle();
  };

  socket.on('connect', handleConnect);
  socket.on('connect_error', handleConnectError);

  const authChangedEvent = `${module}AuthChanged`;
  if (typeof window !== 'undefined') {
    window.addEventListener('authRefreshed', handleAuthRefreshed);
    window.addEventListener(authChangedEvent, handleAuthChanged);
  }

  const destroy = () => {
    destroyed = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('authRefreshed', handleAuthRefreshed);
      window.removeEventListener(authChangedEvent, handleAuthChanged);
    }
    socket.removeAllListeners();
    socket.disconnect();
  };

  return { socket, destroy };
}

export default createRealtimeSocket;
