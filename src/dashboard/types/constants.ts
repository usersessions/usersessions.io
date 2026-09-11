export const FINDING_STATUSES = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DISMISSED: 'dismissed',
  EXECUTED: 'executed',
  PARTIALLY_EXECUTED: 'partially_executed',
} as const;

export const ACTION_STATUSES = {
  PENDING: 'pending',
  APPROVE_REQUIRED: 'approve_required',
  APPROVED: 'approved',
  DISMISSED: 'dismissed',
  EXECUTING: 'executing',
  EXECUTED: 'executed',
  FAILED: 'failed',
} as const;

export const AUTONOMY_LEVELS = {
  AUTO: 'auto',
  APPROVE_REQUIRED: 'approve_required',
} as const;

export type FindingStatus = typeof FINDING_STATUSES[keyof typeof FINDING_STATUSES];
export type ActionStatus = typeof ACTION_STATUSES[keyof typeof ACTION_STATUSES];
export type AutonomyLevel = typeof AUTONOMY_LEVELS[keyof typeof AUTONOMY_LEVELS];
