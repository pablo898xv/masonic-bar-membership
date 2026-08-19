# Masonic Bar Membership Management Platform

A comprehensive membership discount card management platform for the Masonic Hall bar, built with Next.js 16 and Firebase (Firestore).

## Features

- **Member Management**: Track member names, emails, and phone numbers
- **Digital Membership Cards**: QR code-based ewallet tickets (Apple Wallet compatible)
- **Physical Card Support**: Magstripe card encoding with prefix configuration
- **Subscription Management**: Multiple subscription plans with annual duration support
- **Payment Integration**: Pixl Pay integration for card and open banking payments
- **Card Issuance Queue**: Bar manager interface for processing physical cards
- **Till System Integration**: API integration for enabling/disabling cards at the point of sale
- **Renewal Reminders**: Automated email notifications for expiring memberships

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React, TypeScript, Tailwind CSS
- **Database**: Firebase Firestore
- **Authentication**: Firebase Admin SDK + JWT
- **Validation**: Zod
- **QR Codes**: qrcode library
- **Emails**: Nodemailer
- **Hosting**: Firebase Hosting with Cloud Functions

## Firebase Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the setup wizard
3. Enable Firestore Database (choose a region close to your users, e.g., `europe-west1`)
4. Enable Firebase Authentication (optional, for enhanced security)

### 2. Get Firebase Configuration

1. In Firebase Console, go to Project Settings > General
2. Scroll down to "Your apps" and click the web icon (`</>`) to add a web app
3. Register your app and copy the `firebaseConfig` object

### 3. Create Service Account Key

1. In Firebase Console, go to Project Settings > Service Accounts
2. Click "Generate new private key"
3. Save the JSON file securely (never commit to version control)

### 4. Configure Environment Variables

Copy `.env` to `.env.local` and fill in your Firebase configuration:

```bash
# Server-side Firebase (choose one option)
FIREBASE_PROJECT_ID=your-project-id
# Option 1: JSON string (for cloud deployment)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
# Option 2: File path (for local development)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Client-side Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

### 5. Deploy Firestore Rules and Indexes

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy Firestore rules and indexes
firebase deploy --only firestore
```

## Local Development

This matches the live Firebase Hosting + Firestore shape, the same way Pixl Payments mirrors GCP in Docker. Next.js on the host is the Hosting / Cloud Functions stand-in.

| Live (Firebase / GCP) | Local (Docker) |
|-----------------------|----------------|
| Firestore | Firestore emulator (`masonic-firebase`, port 8080) |
| Firebase Auth | Auth emulator (port 9099) |
| Firebase Hosting + Cloud Functions | `npm run dev` on the host (port 3000) |
| Production mail | Mailpit at [http://127.0.0.1:8125](http://127.0.0.1:8125) |

```bash
# One-time / everyday bootstrap
bash deploy/local/setup.sh
# or: npm run local:setup

# Run the app (Hosting equivalent)
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Emulator UI: [http://127.0.0.1:4000](http://127.0.0.1:4000).

```bash
# Reset emulator data
bash deploy/local/setup.sh --reset-volumes
```

## Deployment to Firebase

### 1. Initialize Firebase Hosting

```bash
# Initialize (if not already done)
firebase init hosting

# Select "Use an existing project" and choose your project
# For public directory, keep the default or use "out"
# Configure as SPA: No (Next.js handles routing)
```

### 2. Deploy

```bash
# Build and deploy
npm run build
firebase deploy
```

For Next.js with Firebase, you can use the experimental Firebase Hosting with Web Frameworks:

```bash
# Enable web frameworks (experimental)
firebase experiments:enable webframeworks

# Deploy (this will automatically detect Next.js)
firebase deploy
```

## Cloud Scheduler Setup (Cron Jobs)

Set up scheduled tasks using Google Cloud Scheduler:

### 1. Enable Cloud Scheduler API

```bash
gcloud services enable cloudscheduler.googleapis.com
```

### 2. Create Scheduled Jobs

```bash
# Check membership expiry daily at midnight
gcloud scheduler jobs create http membership-expiry-check \
  --location=europe-west1 \
  --schedule="0 0 * * *" \
  --uri="https://your-app.web.app/api/cron/check-expiry" \
  --http-method=POST \
  --headers="Authorization=Bearer YOUR_CRON_SECRET"

# Send renewal reminders daily at 9 AM
gcloud scheduler jobs create http membership-renewal-reminders \
  --location=europe-west1 \
  --schedule="0 9 * * *" \
  --uri="https://your-app.web.app/api/cron/send-renewal-reminders" \
  --http-method=POST \
  --headers="Authorization=Bearer YOUR_CRON_SECRET"
```

## API Endpoints

### Members
- `GET /api/members` - List all members (with pagination and search)
- `POST /api/members` - Create a new member
- `GET /api/members/[id]` - Get member details
- `PATCH /api/members/[id]` - Update member
- `DELETE /api/members/[id]` - Delete member

### Card Numbers
- `GET /api/card-numbers` - List card numbers with stats
- `POST /api/card-numbers` - Import sequential card numbers
- `GET /api/card-numbers/available` - Get next available card number

### Subscription Plans
- `GET /api/subscription-plans` - List all plans
- `POST /api/subscription-plans` - Create a new plan
- `GET /api/subscription-plans/[id]` - Get plan details
- `PATCH /api/subscription-plans/[id]` - Update plan
- `DELETE /api/subscription-plans/[id]` - Delete/deactivate plan

### Memberships
- `GET /api/memberships` - List all memberships
- `POST /api/memberships` - Create new membership (purchase)
- `GET /api/memberships/[id]` - Get membership details
- `PATCH /api/memberships/[id]` - Update membership
- `POST /api/memberships/[id]/activate` - Activate a paid membership
- `POST /api/memberships/[id]/renew` - Renew an existing membership
- `GET /api/memberships/[id]/wallet-pass` - Get QR code or Apple Wallet pass
- `GET /api/memberships/expiring` - List expiring memberships

### Card Issuance Queue
- `GET /api/card-issuance` - List all card issuances
- `GET /api/card-issuance/queue` - Get prioritized processing queue
- `GET /api/card-issuance/[id]` - Get issuance details
- `PATCH /api/card-issuance/[id]` - Update issuance
- `POST /api/card-issuance/[id]/encode` - Mark card as encoded
- `POST /api/card-issuance/[id]/issue` - Mark card as issued

### Payments
- `POST /api/payments/initiate` - Start a payment
- `GET /api/payments/initiate` - Check payment status
- `POST /api/payments/webhook` - Pixl Pay webhook handler
- `GET /api/payments/mock-checkout` - Mock payment page (dev)
- `POST /api/payments/mock-complete` - Complete mock payment (dev)

### Till System
- `POST /api/till-system/enable` - Enable card in till system
- `POST /api/till-system/disable` - Disable card in till system
- `GET /api/till-system/status` - Check card status in till system

### Cron Jobs
- `POST /api/cron/check-expiry` - Check and expire memberships
- `POST /api/cron/send-renewal-reminders` - Send renewal reminder emails

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/register` - Register first admin
- `GET /api/auth/me` - Get current admin user

## Magstripe Card Encoding

Physical cards are encoded with Track 1 data in the format:
```
;{PREFIX}{CARD_NUMBER}
```

Example: For prefix `;9998` and card number `1500`, the track data is `;99981500`

Configure the prefix in environment variables:
```
MAGSTRIPE_PREFIX=;9998
```

## Integration Notes

### Pixl Pay
- Configure `PIXL_PAY_API_URL` and `PIXL_PAY_API_KEY` when the Pixl Pay platform is ready
- Supports both card payments (Dojo) and open banking
- Webhook endpoint at `/api/payments/webhook` for payment status updates

### Till System
- Configure `TILL_SYSTEM_API_URL` and `TILL_SYSTEM_API_KEY` when ready
- Cards are automatically enabled when issued
- Cards are automatically disabled when memberships expire

### Apple Wallet
- Requires Apple Developer Program membership
- Configure pass certificates and team ID for production use
- QR code fallback always available

### Email Configuration
- Configure SMTP settings for renewal reminders
- Supports Gmail, SendGrid, Mailgun, or any SMTP provider
- HTML templates included for renewal reminder and welcome emails

## Admin Dashboard

Access the admin dashboard at `/admin` with sections for:
- Dashboard overview with stats
- Member management
- Card number inventory
- Subscription plan configuration
- Membership list with filters
- Physical card queue for bar manager
- Settings and integration status

## Security Considerations

1. **Service Account**: Never commit service account keys to version control
2. **Firestore Rules**: Review and customize `firestore.rules` for your security needs
3. **CRON_SECRET**: Set a strong secret for cron job authentication
4. **JWT_SECRET**: Use a strong, unique secret in production
5. **HTTPS**: Always use HTTPS in production (Firebase Hosting provides this automatically)

## License

Private - Masonic Hall Bar
