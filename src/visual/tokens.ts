/**
 * RAILOPT-X Industrial Command-Room Visual Design System Tokens
 * Engineered for authentic, high-density railway operational command consoles.
 * Grounded in physical interlocking optics, matte console materials, and Indian Railways signaling standards.
 */

export const THEME_TOKENS = {
  // Spatial Canvas & Matte Depth Layers (No generic AI dark-blue / glassmorphism)
  canvas: {
    bgDeep: "#060806",
    bgSurface: "#0B0F0C",
    bgElevated: "#121713",
    bgPanel: "#141A16",
    borderSubtle: "#1F2822",
    borderActive: "#343F37",
    borderHighlight: "#FF8C1A", // Warm OCC Amber hero highlight
    gridTechnical: "rgba(255, 255, 255, 0.02)",
  },

  // Physical Railway Signaling & Interlocking States
  railway: {
    trackInactive: "#1A201C",
    trackActive: "#2A332C",
    trackOccupied: "#D62828",       // Physical Signal Red
    trackReserved: "#B8935A",       // Route Locked Brass / Amber
    trackLoop: "#222B25",
    trackBottleneck: "#D45B38",
    
    // 4-Aspect Signal Lamps (Optical incandescent chromaticity)
    signalRed: "#D62828",
    signalAmber: "#E5A93C",
    signalGreen: "#3E9142",
    signalOff: "#171D19",
    signalGlowRed: "0 0 8px rgba(214, 40, 40, 0.6)",
    signalGlowAmber: "0 0 8px rgba(229, 169, 60, 0.6)",
    signalGlowGreen: "0 0 8px rgba(62, 145, 66, 0.6)",
    
    // Train Priority Classes (Functional IR operational tones)
    p5VandeBharat: "#FF8C1A",      // Premium High-Speed Express Gold/Amber
    p5Rajdhani: "#E5A93C",         // Priority Superfast Amber
    p4Express: "#7EA8BE",          // Standard Express Slate Blue
    p3Passenger: "#5E9387",        // Passenger / MEMU Teal
    p2Freight: "#8C9A8E",          // Heavy Freight Neutral Steel/Grey
    p1Maintenance: "#A77C40",      // Maintenance / Inspection Car

    // Backwards compatibility aliases
    p1VandeBharat: "#FF8C1A",
    p2Rajdhani: "#E5A93C",
    p3Express: "#7EA8BE",
    p4Freight: "#8C9A8E",

    // Optimization Candidate Visuals
    optimumBest: "#3E9142",        // Approved Safe Candidate
    candidateFeasible: "#B8935A",    // Alternative Candidate (Route Brass)
    candidateRejected: "#D62828",    // Unsafe / Infeasible
    heroAmber: "#FF8C1A",          // Mechanical Flip-board & Telemetry Hero
  },

  // Typography & Monospace Accents
  typography: {
    fontSans: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: "'JetBrains Mono', 'Fira Code', monospace",
  },

  // Z-Index Elevation Hierarchy
  depth: {
    canvasBackground: 0,
    infrastructureTracks: 10,
    signalsAndLoops: 20,
    candidateGhostRoutes: 30,
    activeTrains: 40,
    conflictOverlays: 50,
    hudCommandRail: 100,
    modalsAndDrawers: 200,
    teleprinterToasts: 300,
  }
} as const;
