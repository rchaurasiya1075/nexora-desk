# Nexora

Paper trading desk (forex, gold, crypto, indices) with **login → deposit request → admin approval → trade**.

## Flow

1. Trader signs in (Google, X, or email/password).
2. Trader picks UPI / QR / bank / SWIFT, sends the amount, pastes UTR.
3. Admin approves. Paper USD is credited to that user id.
4. Trader opens the web trader.

This is a **demo desk**, not a licensed broker. Admin rails (UPI ID, QR, bank details) are instructions you configure. There is no payment gateway.

## Admin

First signed-in operator opens **Admin** and claims the desk.

- **Deposits** — approve / reject; optional USD override
- **Users** — credit / debit, freeze, promote admin
- **Rails** — currencies (units per 1 USD) and payment methods

## Run

```bash
npm install
npm run dev
```

Preview binds `0.0.0.0:8080`. Auth + database flags live in `.grok/app-env.json`.

Firebase is **not wired**. Send the Firebase key when you want that added; Better Auth + Postgres already handles accounts.

## Stack

TanStack Start, React 19, Tailwind v4, Better Auth, Postgres / PGLite.
