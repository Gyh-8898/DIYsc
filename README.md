# Gem Oratopia (Clean Architecture)

This repository now keeps three parts:

1. `miniprogram/` - WeChat Mini Program frontend (user side)
2. `backend/` - official backend service (TypeScript + Prisma)
3. root admin H5 - merchant/admin management frontend (Vite + React)

The old Web user simulator pages were removed, while the admin system is preserved.

## Run

### 1) Admin H5

```bash
npm install
npm run dev:admin
```

### 2) Backend

```bash
npm --prefix backend install
npm run dev:backend
```

### 3) Mini Program

Open `miniprogram/` in WeChat DevTools.

## Notes

- Backend mock entry `backend/server.js` was removed.
- Keep using `backend/src` as the single formal backend implementation.
- Admin entry is now directly in `App.tsx` (AdminDashboard only).
