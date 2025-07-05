# 💰 ScreenPilot Monetization Implementation Guide

## 🔐 License System Implementation

### 1. License Key Generation
```typescript
// src/main/licensing/LicenseManager.ts
import crypto from 'crypto';
import { machineIdSync } from 'node-machine-id';

export class LicenseManager {
  private readonly SECRET = process.env.LICENSE_SECRET!;
  
  generateLicenseKey(email: string, plan: 'starter' | 'pro' | 'team'): string {
    const payload = {
      email,
      plan,
      created: Date.now(),
      expires: Date.now() + (365 * 24 * 60 * 60 * 1000) // 1 year
    };
    
    const data = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', this.SECRET)
      .update(data)
      .digest('hex');
    
    return Buffer.from(`${data}.${signature}`).toString('base64');
  }
  
  async validateLicense(key: string): Promise<boolean> {
    try {
      // Decode and verify
      const decoded = Buffer.from(key, 'base64').toString();
      const [data, signature] = decoded.split('.');
      
      // Check signature
      const expectedSig = crypto
        .createHmac('sha256', this.SECRET)
        .update(data)
        .digest('hex');
      
      if (signature !== expectedSig) return false;
      
      // Check expiration
      const payload = JSON.parse(data);
      if (payload.expires < Date.now()) return false;
      
      // Check device binding (optional)
      const deviceId = machineIdSync();
      if (payload.deviceId && payload.deviceId !== deviceId) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }
}
```

### 2. Stripe Integration
```typescript
// src/main/billing/StripeManager.ts
import Stripe from 'stripe';

export class StripeManager {
  private stripe: Stripe;
  
  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16'
    });
  }
  
  async createCheckoutSession(plan: string, email: string) {
    const prices = {
      starter: process.env.STRIPE_STARTER_PRICE_ID,
      pro: process.env.STRIPE_PRO_PRICE_ID,
      team: process.env.STRIPE_TEAM_PRICE_ID
    };
    
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{
        price: prices[plan],
        quantity: 1
      }],
      mode: 'subscription',
      success_url: 'screenpilot://activate?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://screenpilot.app/pricing',
      metadata: {
        plan,
        app_version: app.getVersion()
      }
    });
    
    return session.url;
  }
  
  async handleWebhook(payload: any, signature: string) {
    const event = this.stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    
    switch (event.type) {
      case 'checkout.session.completed':
        await this.activateLicense(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.deactivateLicense(event.data.object);
        break;
    }
  }
}
```

### 3. Usage Tracking & Limits
```typescript
// src/main/usage/UsageTracker.ts
export class UsageTracker {
  private store: ElectronStore;
  
  async trackAnalysis(userId: string) {
    const today = new Date().toDateString();
    const key = `usage:${userId}:${today}`;
    
    const current = this.store.get(key, 0) as number;
    this.store.set(key, current + 1);
    
    // Check limits
    const plan = await this.getUserPlan(userId);
    const limits = {
      free: 100,
      starter: 1000,
      pro: 10000,
      team: Infinity
    };
    
    if (current >= limits[plan]) {
      throw new Error('Daily limit reached. Please upgrade.');
    }
    
    // Track for analytics
    await this.sendAnalytics({
      event: 'analysis_performed',
      userId,
      plan,
      count: current + 1
    });
  }
}
```

## 💳 Payment UI Implementation

### 1. Pricing Page Component
```tsx
// src/renderer/components/PricingPage.tsx
export const PricingPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  
  const plans = [
    {
      name: 'Starter',
      price: '$9',
      features: [
        '1,000 analyses/day',
        'Basic automation',
        'Email support'
      ],
      cta: 'Start Free Trial',
      popular: false
    },
    {
      name: 'Pro',
      price: '$29',
      features: [
        '10,000 analyses/day',
        'Advanced automation',
        'Priority support',
        'Custom workflows'
      ],
      cta: 'Start Free Trial',
      popular: true
    }
  ];
  
  const handleSubscribe = async (plan: string) => {
    setLoading(true);
    const url = await window.screenpilot.createCheckout(plan);
    window.open(url);
  };
  
  return (
    <div className="pricing-container">
      {plans.map(plan => (
        <PricingCard 
          key={plan.name}
          {...plan}
          onSelect={() => handleSubscribe(plan.name.toLowerCase())}
        />
      ))}
    </div>
  );
};
```

### 2. Trial Banner
```tsx
// src/renderer/components/TrialBanner.tsx
export const TrialBanner: React.FC = () => {
  const [daysLeft, setDaysLeft] = useState(7);
  
  if (daysLeft <= 0) {
    return (
      <div className="trial-expired-banner">
        <span>Free trial expired</span>
        <button onClick={() => navigate('/pricing')}>
          Upgrade Now
        </button>
      </div>
    );
  }
  
  return (
    <div className="trial-banner">
      <span>{daysLeft} days left in trial</span>
      <button onClick={() => navigate('/pricing')}>
        Upgrade
      </button>
    </div>
  );
};
```

## 📊 Analytics & Tracking

### 1. Mixpanel Integration
```typescript
// src/main/analytics/Analytics.ts
import mixpanel from 'mixpanel';

export class Analytics {
  private mp = mixpanel.init(process.env.MIXPANEL_TOKEN!);
  
  track(event: string, properties?: any) {
    this.mp.track(event, {
      ...properties,
      app_version: app.getVersion(),
      platform: process.platform,
      timestamp: Date.now()
    });
  }
  
  revenue(amount: number, currency = 'USD') {
    this.mp.people.track_charge(amount, {
      currency,
      time: new Date()
    });
  }
}
```

### 2. Key Metrics to Track
```typescript
// Track everything for optimization
analytics.track('app_launched');
analytics.track('trial_started');
analytics.track('feature_used', { feature: 'automation_detection' });
analytics.track('limit_reached', { plan: 'free' });
analytics.track('upgrade_clicked', { from: 'limit_banner' });
analytics.track('subscription_started', { plan: 'pro', mrr: 29 });
```

## 🚀 Growth Features

### 1. Referral System
```typescript
// src/main/referral/ReferralManager.ts
export class ReferralManager {
  generateReferralCode(userId: string): string {
    return Buffer.from(userId).toString('base64').slice(0, 8);
  }
  
  async processReferral(code: string, newUserId: string) {
    const referrerId = await this.getReferrerFromCode(code);
    
    // Give referrer 1 month free
    await this.extendSubscription(referrerId, 30);
    
    // Give new user 14-day trial (instead of 7)
    await this.extendTrial(newUserId, 14);
    
    // Track for analytics
    analytics.track('referral_completed', {
      referrer: referrerId,
      referred: newUserId
    });
  }
}
```

### 2. In-App Purchases (Mac App Store)
```typescript
// src/main/store/AppStoreManager.ts
export class AppStoreManager {
  async purchaseProPlan() {
    const { inAppPurchase } = require('electron');
    
    const PRODUCT_IDS = ['com.screenpilot.pro.monthly'];
    
    // Check if can make payments
    if (!inAppPurchase.canMakePayments()) {
      throw new Error('Payments not available');
    }
    
    // Get products
    const products = await inAppPurchase.getProducts(PRODUCT_IDS);
    
    // Purchase
    await inAppPurchase.purchaseProduct(PRODUCT_IDS[0]);
  }
}
```

## 🔒 Anti-Piracy Measures

### 1. Online Activation
```typescript
// Require periodic online checks
class ActivationManager {
  async checkActivation() {
    const lastCheck = this.store.get('lastActivationCheck', 0);
    const now = Date.now();
    
    // Check every 3 days
    if (now - lastCheck > 3 * 24 * 60 * 60 * 1000) {
      const isValid = await this.validateWithServer();
      if (!isValid) {
        this.deactivateApp();
      }
      this.store.set('lastActivationCheck', now);
    }
  }
}
```

### 2. Code Obfuscation
```javascript
// webpack.config.js
const JavaScriptObfuscator = require('webpack-obfuscator');

module.exports = {
  plugins: [
    new JavaScriptObfuscator({
      rotateStringArray: true,
      stringArray: true,
      stringArrayThreshold: 0.75
    }, ['excluded_bundle_name.js'])
  ]
};
```

## 💎 Premium Features to Gate

### Free Tier
- 100 analyses/day
- Basic error detection
- Single monitor
- Standard support

### Pro Features ($29/month)
- Unlimited analyses
- Workflow automation
- Multi-monitor support
- Custom shortcuts
- Priority processing
- API access
- Export functionality
- Team sharing (soon)

### Enterprise (Custom)
- SSO integration
- Admin dashboard
- Usage analytics
- SLA support
- Custom training
- On-premise option

## 📈 Conversion Optimization

### 1. Smart Trial Limits
```typescript
// Give them a taste of premium
class TrialManager {
  getTrialLimits() {
    return {
      analyses: 500, // Generous for trial
      features: ['automation', 'multi_monitor'], // All features
      duration: 7 // days
    };
  }
  
  // Gradually restrict as trial ends
  getDailyLimit(daysLeft: number) {
    if (daysLeft > 3) return 500;
    if (daysLeft > 1) return 200;
    return 100; // Same as free tier
  }
}
```

### 2. Upgrade Prompts
```typescript
// Strategic upgrade nudges
const UPGRADE_TRIGGERS = {
  LIMIT_REACHED: 'You\'ve used all your analyses for today',
  FEATURE_LOCKED: 'Workflow automation is a Pro feature',
  TRIAL_ENDING: 'Your trial ends in 2 days',
  HEAVY_USAGE: 'You\'re a power user! Save 20% with annual'
};
```

## 🎯 Launch Week Revenue Goals

### Day 1: $1,000
- ProductHunt traffic
- 50 trials started
- 10 immediate conversions

### Week 1: $5,000
- 200 trials
- 20% conversion
- First annual plans

### Month 1: $20,000
- 1000 trials
- 15% conversion
- Affiliate program live

Remember: **Price high, discount later**. It's easier to lower prices than raise them! 🚀