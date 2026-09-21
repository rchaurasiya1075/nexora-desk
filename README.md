# Nexora

Paper trading desk (forex, gold, crypto, indices) with **login → deposit request → admin approval → trade**.

**Live site:** https://rchaurasiya1075.github.io/nexora-desk/

## Flow

1. Trader signs in (email on the GitHub live desk; Google/X in the hosted preview).
2. Trader picks UPI / QR / bank / SWIFT, sends the amount, pastes UTR.
3. Admin approves. Paper USD is credited to that user id.
4. Trader opens the web trader.

This is a **demo desk**, not a licensed broker. Admin rails (UPI ID, QR, bank details) are instructions you configure. There is no payment gateway.

## Admin

First signed-in operator opens **Admin** and claims the desk.

- **Deposits** — approve / reject; optional USD override
- **Users** — credit / debit, freeze, promote admin
- **Rails** — currencies (units per 1 USD) and payment methods

On the GitHub live site, accounts live in this browser (so you can sign up a trader, sign out, sign up/claim admin, then approve). Firebase can replace that when you send the key.

## Run

```bash
npm install
npm run dev
```

Auth + database flags live in `.grok/app-env.json`. `npm run build:pages` publishes the GitHub live desk.

Firebase is **not wired**. Send the Firebase key when you want that added; Better Auth + Postgres already handles accounts on the hosted preview.

## Stack

TanStack Start, React 19, Tailwind v4, Better Auth, Postgres / PGLite.
