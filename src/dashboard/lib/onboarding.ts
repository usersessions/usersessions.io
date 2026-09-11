/**
 * Onboarding progress label — shared by the server layout (mobile nav) and the
 * client SidebarNav. Lives outside any 'use client' module so the server can
 * call it directly (calling a client-module export from the server throws
 * "Attempted to call onboardingLabel() from the server").
 */
export interface OnboardingProgress {
  done: number
  total: number
}

// "Get started 2/4" while onboarding is in progress, "✓ Get started" once complete.
export function onboardingLabel(onboarding?: OnboardingProgress): string {
  if (!onboarding) return 'Get started'
  if (onboarding.done >= onboarding.total) return '✓ Get started'
  return `Get started ${onboarding.done}/${onboarding.total}`
}
