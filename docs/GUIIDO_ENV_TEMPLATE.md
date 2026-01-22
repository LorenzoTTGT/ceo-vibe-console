# Guiido Carsharing - Environment Variables Template

This document describes the environment variables needed to run the guiido-carsharing app locally.

## Quick Setup

Copy your `.env.local` from `/Users/lorenzo/guiido-carsharing/.env.local` into the Vibe Console's Environment Variables modal.

## Required Variables by Category

### Database (Neon PostgreSQL)
```env
NEON_DATABASE_URL=postgresql://...
NEON_DIRECT_URL=postgresql://...  # For migrations
NEON_API_KEY=napi_...
USE_NEON_DB=true
```

### Authentication (Better Auth)
```env
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:3000
AUTH_SECRET=...  # Same as BETTER_AUTH_SECRET
NEXTAUTH_SECRET=...  # Legacy, same value
NEXTAUTH_URL=http://localhost:3000
BETTER_AUTH_SECURE_COOKIES=false  # Set false for localhost
```

### Google OAuth
```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Stripe Payments
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Email Service (Brevo)
```env
BREVO_API_KEY=xkeysib-...
BREVO_FROM_EMAIL=Guiido <contact@guiido.com>
```

### Storage (Cloudflare R2)
```env
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=guiido-media
R2_PUBLIC_URL=https://...
```

### Real-time Messaging (Centrifugo + Redis)
```env
REDIS_URL=rediss://...
CENTRIFUGO_API_URL=https://ws.guiido.com/api
CENTRIFUGO_WS_URL=wss://ws.guiido.com/connection/websocket
NEXT_PUBLIC_CENTRIFUGO_WS_URL=wss://ws.guiido.com/connection/websocket
CENTRIFUGO_TOKEN_SECRET=...
CENTRIFUGO_API_KEY=...
USE_CENTRIFUGO=true
```

### Maps (TomTom)
```env
NEXT_PUBLIC_TOMTOM_API_KEY=...
TOMTOM_API_KEY=...
```

### CMS (Sanity)
```env
NEXT_PUBLIC_SANITY_PROJECT_ID=jjdm6nuy
NEXT_PUBLIC_SANITY_DATASET=production
SANITY_API_VERSION=2024-01-01
SANITY_API_TOKEN=...
```

### Analytics
```env
NEXT_PUBLIC_POSTHOG_KEY=...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-...
NEXT_PUBLIC_META_PIXEL_ID=...
```

### KYC (Dataleon)
```env
DATALEON_API_KEY=apkey_...
DATALEON_WORKSPACE_ID_LICENSE=wk_...
DATALEON_WORKSPACE_ID_PASSPORT=wk_...
DATALEON_WEBHOOK_SECRET=whkey_...
```

### Application
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=...
```

### Dev Bypass Flags (for local development)
```env
DEV_BYPASS_EMAIL_VERIFICATION=false
DEV_BYPASS_DATALEON_KYC=true
DEV_BYPASS_STRIPE_CONNECT=false
DEV_BYPASS_NOTIFICATIONS=false
ENFORCE_KYC_IN_DEV=false
```

## For Vibe Console Local Development

When running via Vibe Console, change these URLs to use port 3001:
- `BETTER_AUTH_URL=http://localhost:3001`
- `NEXTAUTH_URL=http://localhost:3001`
- `NEXT_PUBLIC_APP_URL=http://localhost:3001`
- `AUTH_URL=http://localhost:3001`

## Notes

- The app uses Better Auth (not NextAuth) for authentication
- Database is Neon PostgreSQL (not Supabase)
- Real-time uses Centrifugo WebSockets + Upstash Redis
- Maps use TomTom (migrated from MapTiler/OpenRouteService)
