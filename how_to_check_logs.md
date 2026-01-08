# How to Check Edge Function Logs

## Option 1: Click on the Execution IDs in Supabase Dashboard

1. In the Supabase Dashboard → Logs → Edge Functions → send-push-notification
2. You'll see a list of POST requests with IDs (like `68689ca6-53c3-4c75-88d5-85395cddbc97`)
3. **Click on each ID** to see the detailed logs for that execution
4. Look for entries around the time you completed the gig (around 16:47:48 based on your logs)
5. You should see two separate executions - one for neighbor, one for teen

## Option 2: Check the Local Debug Log File

After completing a gig, check the file:
`/Users/jasongelsomino/Ollie/.cursor/debug.log`

This file will contain detailed logs from the Edge Function showing:
- What recipient_id was received
- What body text was received
- Which user was looked up

## What to Look For

When you complete a gig, you should see TWO separate Edge Function calls:
1. **Neighbor call**: recipient_id = neighbor's ID, body = "Tommy Gunn completed: ..."
2. **Teen call**: recipient_id = teen's ID, body = "You completed: ... - Payment pending"

If the neighbor is receiving the teen's notification, we'll see it in the logs.











