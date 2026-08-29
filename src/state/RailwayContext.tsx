/**
 * RailwayContext — Re-exported from authoritative OperationalStore.
 * Eliminates duplicate state systems and provides backward compatibility.
 */
export { OperationalStoreProvider as RailwayProvider, useOperationalStore as useRailway } from "./OperationalStore";
export type { OperationalState as RailwayState } from "./OperationalStore";
