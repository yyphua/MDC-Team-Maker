# Fix Super Admin Role

## Problem
You're getting 403 errors because your account doesn't have the SUPER_ADMIN role.

## Root Cause
The system assigns SUPER_ADMIN role **only** when:
1. You sign in for the **first time**
2. Your email **exactly matches** `SUPER_ADMIN_EMAIL` in `.env`

## Solutions

### Option 1: Sign In with Super Admin Email (Easiest)
1. Sign out
2. Sign in with: `dodgeballclubmonash@gmail.com`
3. System will automatically assign SUPER_ADMIN role

### Option 2: Update Database Manually

Run this command to update your current user's role:

```bash
npx prisma studio
```

Then:
1. Click on "User" table
2. Find your user record
3. Change `role` field from `USER` to `SUPER_ADMIN`
4. Save
5. Refresh your browser

### Option 3: Reset Database (Nuclear Option)

```bash
# Delete database
rm prisma/dev.db

# Recreate with migrations
npx prisma migrate dev

# Sign in again - you'll be assigned correct role
```

## Verification

After fixing, you should be able to:
- ✅ Access `/api/sessions` (no 403)
- ✅ Create sessions
- ✅ Manage users via `/api/admin/users`

## Note
The `/admin/users` page (404 error) doesn't exist yet - we only created the API endpoint. You'll need to build the frontend page separately.
