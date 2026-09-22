# Nexora

Paper trading desk — live FX/crypto/gold anchors, Firebase login, deposits, admin desk.

**Live site (open this):** [https://rchaurasiya1075.github.io/nexora-desk/](https://rchaurasiya1075.github.io/nexora-desk/)

Web trader: [https://rchaurasiya1075.github.io/nexora-desk/#/trade](https://rchaurasiya1075.github.io/nexora-desk/#/trade)

This is a Nexora-branded **demo / paper** desk. It is not FOREX.com and not a licensed broker.

## Firebase (`nexora-bb654`)

Do this once in [Firebase Console](https://console.firebase.google.com/project/nexora-bb654):

1. **Authentication → Get started → Email/Password → Enable**
2. **Firestore Database → Create** (production mode is fine; rules are in `firestore.rules`)
3. **Authentication → Settings → Authorized domains** add:
   - `rchaurasiya1075.github.io`
   - your custom domain (after you buy it)
4. First signed-in account can **claim admin** on `/#/admin`

Web config lives in `src/lib/firebase/config.ts`.

## Custom domain (GoDaddy)

After you buy the domain, send me the name. Until then:

1. GoDaddy → DNS → **CNAME**: `www` → `rchaurasiya1075.github.io`
2. GoDaddy → DNS → **A** records for `@`:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
3. GitHub repo **nexora-desk** → Settings → Pages → Custom domain → `www.yourdomain.com`
4. Add `www.yourdomain.com` and `yourdomain.com` under Firebase authorized domains
