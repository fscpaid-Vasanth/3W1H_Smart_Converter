/**
 * Razorpay Subscription Plans Configuration
 * 
 * 🚨 CRITICAL: When switching to Live Mode, update these PLAN IDs 
 * with the ones from your Razorpay Live Dashboard.
 */

export const PLANS = {
    // Live Plan IDs
    "plan_SJ7ZNktTUB9PNr": { name: "Basic", credits: 500 },
    "plan_SJ7azBfqgFOu3R": { name: "Pro", credits: 1200 },
    "plan_SJ7c3ilphWBQmh": { name: "Premium", credits: -1 } // -1 = unlimited
};

export const getPlanByName = (name) => {
    return Object.values(PLANS).find(p => p.name === name);
};

export const getPlanNameById = (id) => {
    return PLANS[id]?.name || "Unknown Plan";
};
