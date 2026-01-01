# CMU Predictions

A prediction betting platform designed specifically for Carnegie Mellon University students to bet on campus events, academic outcomes, sports, and CMU-specific happenings using virtual currency.

## Features

- **User Authentication**: Sign up restricted to @andrew.cmu.edu emails
- **Virtual Currency System**: Start with 1,000 credits, receive 200 bonus credits monthly
- **Prediction Markets**: Browse and bet on various campus events
- **Parimutuel Betting**: Fair odds calculated based on the betting pool
- **Leaderboard**: Compete with fellow students based on 30-day ROI
- **Admin Dashboard**: Create and resolve markets (admin-only)

## Tech Stack

- **Frontend/Backend**: Next.js 14+ (App Router, TypeScript)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS
- **Hosting**: Vercel (recommended)

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project

### Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd polybet
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Set up the database:
   - Go to your Supabase project's SQL Editor
   - Run the contents of `supabase/schema.sql`

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

### Making a User an Admin

To make a user an admin, run this SQL in your Supabase SQL Editor:

```sql
UPDATE profiles
SET is_admin = true
WHERE email = 'your-email@andrew.cmu.edu';
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/             # Admin dashboard
│   ├── auth/              # Authentication pages
│   ├── leaderboard/       # Leaderboard page
│   ├── market/[id]/       # Individual market page
│   ├── markets/           # Markets listing
│   └── profile/           # User profile
├── components/            # React components
│   ├── auth/             # Auth-related components
│   ├── layout/           # Layout components (navbar, footer)
│   ├── markets/          # Market-related components
│   └── ui/               # Reusable UI components
├── lib/
│   └── supabase/         # Supabase client configuration
└── types/                # TypeScript type definitions
```

## Database Schema

- **profiles**: User profiles with credits and admin status
- **markets**: Prediction markets with status tracking
- **market_options**: Options for each market
- **bets**: User bets on market options
- **transactions**: Credit transaction history

## Key Features

### Virtual Currency
- Users start with 1,000 credits
- Monthly bonus of 200 credits (claimable once per month)
- Credits are used for placing bets and won through successful predictions

### Betting System
- Parimutuel betting pool system
- Potential payouts calculated based on current pool distribution
- Winnings distributed proportionally when markets are resolved

### Leaderboard
- Rankings based on 30-day trailing ROI (Return on Investment)
- Shows total wagered, total won, and current credits

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

## License

This project is for educational purposes only.
