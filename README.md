# Sikkaaa

Paper trading desk — live FX/crypto/gold anchors, Firebase login, deposits, admin desk.

**Live site:** [https://sikkaaa.in/](https://sikkaaa.in/)

Web trader: [https://sikkaaa.in/#/trade](https://sikkaaa.in/#/trade)

This is a Sikkaaa-branded **demo / paper** desk. It is not FOREX.com and not a licensed broker.

## Firebase (`nexora-bb654`)

Do this once in [Firebase Console](https://console.firebase.google.com/project/nexora-bb654):

1. **Authentication → Sign-in method → Email/Password → Enable** (required for Gmail + password and Forgot password)
2. **Authentication → Settings → Authorized domains** add `sikkaaa.in` and `www.sikkaaa.in` (required for Continue with Google and the reset link)
3. **Firestore Database → Create** if it does not exist yet
4. Admin desk login stays user id `yuvraj1075` (not a Gmail)

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
