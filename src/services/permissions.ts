/**
 * RAILOPT-X Role-Based Access Control (RBAC) Permission System
 * 
 * Prototype role-based authorization context.
 * The backend remains the authoritative enforcement layer via X-User-Role header checks.
 * This frontend layer provides immediate UI feedback by disabling/hiding controls
 * the current role cannot use, rather than failing with a 403 after click.
 */

export type OperatorRole = "Controller" | "Supervisor" | "Admin" | "Analyst";

export type OperatorAction =
  | "controlSimulation"
  | "optimize"
  | "approveDecision"
  | "injectDisruption"
  | "whatIf"
  | "analytics"
  | "audit"
  | "safetyConfig";

const ROLE_PERMISSIONS: Record<OperatorRole, Record<OperatorAction, boolean>> = {
  Controller: {
    controlSimulation: true,
    optimize: true,
    approveDecision: true,
    injectDisruption: false,
    whatIf: true,
    analytics: true,
    audit: true,
    safetyConfig: false,
  },
  Supervisor: {
    controlSimulation: true,
    optimize: true,
    approveDecision: true,
    injectDisruption: true,
    whatIf: true,
    analytics: true,
    audit: true,
    safetyConfig: false,
  },
  Admin: {
    controlSimulation: true,
    optimize: true,
    approveDecision: true,
    injectDisruption: true,
    whatIf: true,
    analytics: true,
    audit: true,
    safetyConfig: true,
  },
  Analyst: {
    controlSimulation: false,
    optimize: false,
    approveDecision: false,
    injectDisruption: false,
    whatIf: true,
    analytics: true,
    audit: true,
    safetyConfig: false,
  },
};

/**
 * Check whether the given role is authorized to perform the specified action.
 */
export function canPerform(role: OperatorRole, action: OperatorAction): boolean {
  return ROLE_PERMISSIONS[role]?.[action] ?? false;
}

/**
 * Human-readable role descriptions for the role context switcher.
 */
export const ROLE_DESCRIPTIONS: Record<OperatorRole, { title: string; subtitle: string }> = {
  Controller: { title: "SECTION CONTROLLER", subtitle: "Dispatch & decisions" },
  Supervisor: { title: "SUPERVISOR", subtitle: "Operations authority" },
  Admin: { title: "SAFETY ADMIN", subtitle: "System governance" },
  Analyst: { title: "PERFORMANCE ANALYST", subtitle: "Read-only analytics" },
};

/**
 * Returns the minimum role required for an action, for tooltip display.
 */
export function requiredRoleFor(action: OperatorAction): string {
  if (ROLE_PERMISSIONS.Controller[action]) return "Controller";
  if (ROLE_PERMISSIONS.Supervisor[action]) return "Supervisor";
  if (ROLE_PERMISSIONS.Admin[action]) return "Admin";
  return "Admin";
}
