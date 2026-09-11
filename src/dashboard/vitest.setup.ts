// Global test setup — runs before each test file.
// Provide minimal env vars that the billing and AI modules need so tests can
// import them without crashing.  Individual tests override these as needed.
process.env.PAYSTACK_SECRET_KEY = 'sk_test_placeholder'
process.env.PAYSTACK_PLAN_FOUNDER_MONTHLY = 'PLN_founder_monthly'
process.env.PAYSTACK_PLAN_FOUNDER_ANNUAL = 'PLN_founder_annual'
process.env.PAYSTACK_PLAN_AGENCY_MONTHLY = 'PLN_agency_monthly'
process.env.GEMINI_API_KEY = 'AIza_test_placeholder'
process.env.GEMINI_MODEL = 'gemini-3.6-flash'
process.env.NEXT_PUBLIC_SITE_URL = 'https://usersessions.io'
