# Masonic Hall Bar - Membership Discount Card Platform

A comprehensive membership management system for the Masonic Hall Bar, supporting both digital QR code cards and physical magstripe cards.

## Features

### Member Management
- Member registration with name, email, and phone number
- Member search and management interface
- Member profile with membership history

### Membership Cards
- **Digital QR Code Cards**: Instant issue digital membership cards
  - QR code generation for easy scanning at the bar
  - Apple Wallet pass support (requires configuration)
  - Downloadable QR code images
  
- **Physical Magstripe Cards**: Traditional swipe cards
  - Magstripe encoding queue for bar manager
  - Track 1 data format: `{PREFIX}{CARD_NUMBER}` (e.g., `;99981500`)
  - Card issuance tracking workflow

### Card Number Management
- Import sequential batches of card numbers
- Track assigned vs available numbers
- Support for physical card inventory management

### Subscription Plans
- Configurable subscription periods (1 year, 2 years, etc.)
- Flexible pricing per plan
- Active/inactive plan management

### Payment Integration
- **Pixl Pay Platform** integration stub (to be connected)
  - Card payments via Dojo
  - Open Banking payments
- Mock payment flow for development/testing

### Till System Integration
- API stub for external till system integration
- Enable/disable cards for access control
- Automatic expiry handling

### Card Issuance Queue
- Queue management for physical card processing
- States: Pending → Ready to Encode → Encoded → Issued
- Magstripe encoding instructions with data display

### Expiry Management
- Automatic expiry checking (cron endpoint)
- Renewal workflow for existing memberships
- Expiring memberships alerts

### Renewal Reminders
- Automated email reminders sent 30 days before expiry
- Members receive personalized renewal links
- Self-service renewal page for cardholders
- Tracks sent reminders to avoid duplicates

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Create database
npx prisma db push

# Run development server
npm run dev
```

### Environment Variables

Copy `.env` and configure:

```env
# Database
DATABASE_URL="file:./dev.db"

# JWT Secret for admin authentication
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# Pixl Pay Integration
PIXL_PAY_API_URL="https://api.pixlpay.example.com"
PIXL_PAY_API_KEY=""
PIXL_PAY_MERCHANT_ID=""

# Till System Integration
TILL_SYSTEM_API_URL=""
TILL_SYSTEM_API_KEY=""

# Apple Wallet Pass Configuration
PASS_TYPE_IDENTIFIER="pass.com.masonichall.membership"
TEAM_IDENTIFIER="YOUR_APPLE_TEAM_ID"
PASS_CERTIFICATE_PATH="./certs/pass.p12"
PASS_CERTIFICATE_PASSWORD=""

# Magstripe Card Configuration
MAGSTRIPE_PREFIX=";9998"

# Application URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Email Configuration (SMTP)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
EMAIL_FROM="Masonic Hall Bar <noreply@masonichall.bar>"

# Cron Job Secret (optional)
CRON_SECRET=""
```

## Usage

### Admin Dashboard

Access the admin dashboard at `/admin`:

1. **Dashboard**: Overview of members, memberships, and card queue status
2. **Members**: Add and manage members
3. **Memberships**: View all memberships and their status
4. **Card Queue**: Process physical card encoding and issuance
5. **Card Numbers**: Import and manage card number inventory
6. **Subscriptions**: Configure membership plans and pricing
7. **Settings**: Integration status and maintenance

### Member Registration

Public registration at `/membership/register`:

1. Enter personal details (name, email, phone)
2. Select subscription plan and card type
3. Choose payment method
4. Complete payment
5. Receive digital card (QR) or wait for physical card

### Physical Card Workflow

1. Member purchases physical card membership
2. Payment completes → card enters "Ready to Encode" queue
3. Bar manager encodes magstripe data using card writer
4. Card marked as "Encoded"
5. Member collects card → marked as "Issued"
6. System enables card in till system

### API Endpoints

#### Members
- `GET /api/members` - List members
- `POST /api/members` - Create member
- `GET /api/members/[id]` - Get member
- `PATCH /api/members/[id]` - Update member

#### Memberships
- `GET /api/memberships` - List memberships
- `POST /api/memberships` - Create membership
- `GET /api/memberships/[id]` - Get membership
- `POST /api/memberships/[id]/activate` - Activate membership
- `POST /api/memberships/[id]/renew` - Renew membership
- `GET /api/memberships/[id]/wallet-pass` - Get wallet pass/QR code
- `GET /api/memberships/expiring` - Get expiring memberships

#### Card Numbers
- `GET /api/card-numbers` - List card numbers
- `POST /api/card-numbers` - Import card numbers
- `GET /api/card-numbers/available` - Get next available number

#### Card Issuance
- `GET /api/card-issuance` - List card issuances
- `GET /api/card-issuance/queue` - Get issuance queue
- `PATCH /api/card-issuance/[id]` - Update issuance status
- `POST /api/card-issuance/[id]/encode` - Mark as encoded
- `POST /api/card-issuance/[id]/issue` - Mark as issued

#### Subscription Plans
- `GET /api/subscription-plans` - List plans
- `POST /api/subscription-plans` - Create plan
- `PATCH /api/subscription-plans/[id]` - Update plan

#### Payments
- `POST /api/payments/initiate` - Initiate payment
- `POST /api/payments/webhook` - Payment webhook
- `GET /api/payments/mock-checkout` - Mock checkout (dev)

#### Till System
- `POST /api/till-system/enable` - Enable card
- `POST /api/till-system/disable` - Disable card
- `GET /api/till-system/status` - Check card status

#### Maintenance / Cron
- `POST /api/cron/check-expiry` - Run expiry check and disable expired cards
- `POST /api/cron/send-renewal-reminders` - Send 30-day renewal reminder emails

## Integration Notes

### Pixl Pay Integration

The payment integration is stubbed and ready for connection to the Pixl Pay platform. Configure the following:

1. Set `PIXL_PAY_API_URL` to the Pixl Pay API endpoint
2. Set `PIXL_PAY_API_KEY` for authentication
3. Set `PIXL_PAY_MERCHANT_ID` for the Masonic Hall Bar merchant account

The integration supports:
- Card payments via Dojo
- Open Banking payments
- Webhook handling for payment status updates

### Till System Integration

The till system integration is prepared for the external access control system. When ready:

1. Set `TILL_SYSTEM_API_URL` to the till system endpoint
2. Set `TILL_SYSTEM_API_KEY` for authentication
3. The system will automatically enable cards on activation and disable on expiry

### Apple Wallet Pass

To enable Apple Wallet pass generation:

1. Create a Pass Type ID in Apple Developer Portal
2. Generate and export a signing certificate
3. Configure the environment variables
4. The system will generate `.pkpass` files for download

## Magstripe Card Format

Physical cards use Track 1 encoding with the format:

```
;9998{CARD_NUMBER}
```

Example for card number 1500:
```
;99981500
```

The prefix can be changed via the `MAGSTRIPE_PREFIX` environment variable.

## License

Private - Masonic Hall Bar
