/**
 * Realtime socket entry point.
 *
 * Use `createRealtimeSocket` rather than calling `io()` directly — it owns URL resolution,
 * connection options and token-refresh recovery, so those cannot drift between modules again.
 */

export {
  createRealtimeSocket,
  resolveSocketOrigin,
  readModuleToken,
} from './createRealtimeSocket.js';
export { default } from './createRealtimeSocket.js';
