/**
 * RAILOPT-X 2.0 — Centralized Environment & Networking Configuration
 * 
 * Provides unified, single-source API and WebSocket URLs across development,
 * test, and Docker production environments.
 */

const isBrowser = typeof window !== "undefined";

// Default REST Base URL
export const API_BASE_URL: string = 
  (import.meta.env && import.meta.env.VITE_API_BASE_URL) || 
  (isBrowser && window.location.port === "3000" ? "" : "http://127.0.0.1:8000");

// Default WebSocket URL
export const WS_URL: string = 
  (import.meta.env && import.meta.env.VITE_WS_URL) ||
  (isBrowser && window.location.port === "3000" 
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/live`
    : "ws://127.0.0.1:8000/ws/live");
