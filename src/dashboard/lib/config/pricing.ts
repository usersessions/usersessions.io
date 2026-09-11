import { PLANS } from '@/lib/tiers'

/**
 * Pricing tiers for display in the UI.
 * This file pulls directly from the unified @/lib/tiers.ts to prevent mismatches.
 */
export const PRICING_TIERS = {
  STARTER: {
    name: PLANS.starter.name,
    price: PLANS.starter.price.monthly / 100,
    interval: "month",
    features: PLANS.starter.features,
  },
  PRO: {
    name: PLANS.pro.name,
    price: PLANS.pro.price.monthly / 100,
    interval: "month",
    features: PLANS.pro.features,
  },
  BUSINESS: {
    name: PLANS.business.name,
    price: PLANS.business.price.monthly / 100,
    interval: "month",
    features: PLANS.business.features,
  },
  ENTERPRISE: {
    name: PLANS.enterprise.name,
    price: 0, // Contact Sales
    interval: "month",
    features: PLANS.enterprise.features,
  }
};
