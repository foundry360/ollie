# Run Migration 015 - Email/Phone Pre-validation Function

## Problem
The pre-validation check wasn't working because RLS (Row Level Security) was blocking unauthenticated users from querying existing records in `pending_neighbor_applications`.

## Solution
Created a `SECURITY DEFINER` function that bypasses RLS to check if email or phone already exists.

## Steps to Run Migration

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of:
   ```
   supabase/migrations/015_check_email_phone_exists_function.sql
   ```
5. Click **Run** or press Cmd/Ctrl + Enter

## What This Does
- Creates function `check_email_phone_exists(email, phone)`
- Function checks both `pending_neighbor_applications` and `users` tables
- Returns JSON: `{ "emailExists": boolean, "phoneExists": boolean }`
- Bypasses RLS so unauthenticated users can check for duplicates before signup
- Grants execute permission to both `authenticated` and `anon` users

## After Running
The signup flow will now:
1. ✅ Check email and phone BEFORE creating auth user
2. ✅ Show both error messages if both are duplicates
3. ✅ Prevent creating orphaned auth users when phone is duplicate

