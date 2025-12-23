# Messaging Logic Overview

## Simple Rules

### Who Can Message Whom?

1. **Neighbors (Posters) can message:**
   - Assigned teenlancers on their gigs (assigned gigs)
   - Any teenlancer who has applied to their open gigs (via "Message" button on applicant)
   - Any teenlancer they've already messaged (continuing conversation)

2. **Teenlancers can message:**
   - Neighbors who posted gigs they're assigned to (assigned gigs)
   - Neighbors who posted open gigs (to inquire about the gig)
   - Neighbors they've already messaged (continuing conversation)

### How Recipient is Determined

The chat screen determines who to message in this priority order:

1. **Explicit `recipientId` from URL** (highest priority)
   - When neighbor clicks "Message" on an applicant, the teenlancer's ID is passed in the URL
   - Example: `/chat/123?recipientId=456`

2. **Assigned Gigs**
   - If gig has a `teen_id` (assigned):
     - Neighbor → messages the assigned teen
     - Teen → messages the neighbor (poster)

3. **Open Gigs with Existing Messages**
   - If there are already messages, find the other user from those messages
   - This allows continuing conversations

4. **Open Gigs without Messages**
   - If user is NOT the poster → they can message the poster
   - If user IS the poster → they need a `recipientId` (must click "Message" on applicant)

### RLS Policy (Database Security)

The database allows message creation if:
- User is the poster of the gig (can message anyone about their gigs)
- User is the assigned teen of the gig (can message the poster)
- Gig is open (allows any user to message about open gigs)

## Common Issues

### "Unable to send message" Error

This happens when:
- No `recipientId` is provided AND
- Gig is open AND
- User is the poster AND
- No existing messages exist

**Solution:** Neighbor must click "Message" button on an applicant card to start conversation.

### Why This Design?

- **Open gigs** can have multiple applicants, so neighbors need to specify which teenlancer to message
- **Assigned gigs** have a clear 1-to-1 relationship (poster ↔ teen)
- **Existing conversations** can continue without needing to specify recipient again







