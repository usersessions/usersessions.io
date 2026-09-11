import { FINDING_STATUSES } from '@/types/constants'
import React from 'react'
import { PiClockBold, PiCheckCircleBold, PiXCircleBold, PiLightningBold } from 'react-icons/pi'

export const SEV_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  P0: { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444', label: 'Critical' },
  P1: { bg: 'rgba(249,115,22,0.1)',  color: '#f97316', label: 'High' },
  P2: { bg: 'rgba(234,179,8,0.1)',   color: '#ca8a04', label: 'Medium' },
  P3: { bg: 'rgba(99,102,241,0.1)',  color: '#6366f1', label: 'Low' },
}

export const SEV_CLASS: Record<string, string> = {
  P0: 'ds-badge ds-badge--p0',
  P1: 'ds-badge ds-badge--p1',
  P2: 'ds-badge ds-badge--p2',
  P3: 'ds-badge ds-badge--p3',
}

export const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug', friction: 'Friction', billing: 'Billing', security: 'Security',
}

export const STATUS_ICONS: Record<string, React.ReactNode> = {
  [FINDING_STATUSES.PENDING]:   <PiClockBold size={13} />,
  [FINDING_STATUSES.PARTIALLY_EXECUTED]:  <PiCheckCircleBold size={13} />,
  [FINDING_STATUSES.DISMISSED]: <PiXCircleBold size={13} />,
  [FINDING_STATUSES.EXECUTED]:  <PiLightningBold size={13} />,
}
