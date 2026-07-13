# Email Notifications Setup Guide

Apex Quant uses Supabase Edge Functions with email providers like Resend or SendGrid to send email notifications to users.

## Prerequisites

1. A Supabase project
2. An email service account (Resend or SendGrid recommended)

## Step 1: Run the SQL Setup

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `email-setup.sql`
4. Click **Run** to execute

This creates:
- `email_logs` table - stores all sent email records
- `email_templates` table - stores email template definitions
- `log_email()` function - for logging emails
- `get_user_email()` function - for retrieving user emails

## Step 2: Set Up Resend (Recommended)

### 2.1 Create a Resend Account

1. Go to [resend.com](https://resend.com) and sign up
2. Verify your domain or use their test API key
3. Create an API key from your dashboard

### 2.2 Add API Key to Supabase

1. Go to your Supabase project settings
2. Navigate to **Edge Functions** → **Secrets**
3. Add a new secret:
   - Name: `RESEND_API_KEY`
   - Value: your Resend API key

### 2.3 Create the Edge Function

1. Install the Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Initialize Edge Functions in your project:
   ```bash
   supabase init
   ```

3. Create a new edge function:
   ```bash
   supabase functions new send-email
   ```

4. Replace the contents of `supabase/functions/send-email/index.ts` with:

   ```typescript
   import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
   import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

   const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

   interface EmailPayload {
     to: string;
     subject: string;
     html: string;
     type?: string;
     userId?: string;
   }

   serve(async (req) => {
     try {
       const { to, subject, html, type, userId }: EmailPayload = await req.json();

       // Create Supabase client
       const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
       const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
       const supabase = createClient(supabaseUrl, supabaseKey);

       // Send email via Resend
       const res = await fetch("https://api.resend.com/emails", {
         method: "POST",
         headers: {
           "Authorization": `Bearer ${RESEND_API_KEY}`,
           "Content-Type": "application/json",
         },
         body: JSON.stringify({
           from: "Apex Quant <noreply@apexquant.com>",
           to: [to],
           subject: subject,
           html: html,
         }),
       });

       if (!res.ok) {
         const error = await res.text();
         console.error("Resend API error:", error);
         throw new Error(error);
       }

       // Log the email
       if (userId) {
         await supabase.rpc("log_email", {
           p_user_id: userId,
           p_type: type || "general",
           p_recipient: to,
           p_subject: subject,
           p_body: html,
         });
       }

       return new Response(JSON.stringify({ success: true }), {
         headers: { "Content-Type": "application/json" },
       });
     } catch (error) {
       console.error("Error sending email:", error);
       return new Response(JSON.stringify({ error: error.message }), {
         status: 500,
         headers: { "Content-Type": "application/json" },
       });
     }
   });
   ```

5. Deploy the function:
   ```bash
   supabase functions deploy send-email
   ```

## Step 3: Alternative - Set Up SendGrid

### 3.1 Create a SendGrid Account

1. Go to [sendgrid.com](https://sendgrid.com) and sign up
2. Create an API key with Mail Send permissions

### 3.2 Add API Key to Supabase

1. Go to your Supabase project settings
2. Navigate to **Edge Functions** → **Secrets**
3. Add a new secret:
   - Name: `SENDGRID_API_KEY`
   - Value: your SendGrid API key

### 3.3 Modify the Edge Function

Replace the email sending section with:

```typescript
// Send email via SendGrid
const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");

const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${SENDGRID_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    personalizations: [{ to: [{ email: to }] }],
    from: { email: "noreply@apexquant.com", name: "Apex Quant" },
    subject: subject,
    content: [{ type: "text/html", value: html }],
  }),
});
```

## Step 4: Trigger Emails from Your App

### Example: Send Welcome Email After Signup

Add this to your app after a successful signup:

```javascript
// In app.js after successful signup
async function sendWelcomeEmail(user) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      to: user.email,
      subject: 'Welcome to Apex Quant!',
      html: `
        <h1>Welcome to Apex Quant!</h1>
        <p>Thank you for joining us. Start earning guaranteed returns today!</p>
        <p>Best regards,<br>The Apex Quant Team</p>
      `,
      type: 'welcome',
      userId: user.id
    })
  });
  
  return response.json();
}
```

### Example: Send Deposit Approved Email

```javascript
async function sendDepositApprovedEmail(userId, amount) {
  const { data: user } = await supabase.auth.admin.getUserById(userId);
  
  await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      to: user.email,
      subject: 'Deposit Approved - Funds Added',
      html: `
        <h1>Deposit Approved!</h1>
        <p>Your deposit of $${amount} has been approved and added to your account.</p>
        <p>Start investing now to earn guaranteed returns!</p>
      `,
      type: 'deposit_approved',
      userId: userId
    })
  });
}
```

## Step 5: Testing

1. Use Supabase Edge Function local development:
   ```bash
   supabase functions serve send-email
   ```

2. Test with a simple curl:
   ```bash
   curl -X POST http://localhost:54321/functions/v1/send-email \
     -H "Content-Type: application/json" \
     -d '{"to":"test@example.com","subject":"Test","html":"<p>Test email</p>"}'
   ```

## Email Templates

The system uses the following email types:

| Type | Description |
|------|-------------|
| `welcome` | New user registration |
| `deposit_approved` | Deposit confirmed |
| `deposit_rejected` | Deposit rejected |
| `withdrawal_requested` | Withdrawal submitted |
| `withdrawal_approved` | Withdrawal processed |
| `withdrawal_rejected` | Withdrawal rejected |
| `investment_created` | New investment made |
| `investment_completed` | Investment matured |
| `account_frozen` | Account frozen |

## Troubleshooting

### Emails Not Sending

1. Check your API key is correctly set as a secret
2. Verify your email domain is verified (for production)
3. Check the Supabase Edge Function logs for errors

### Database Logs Not Recording

1. Ensure the `log_email` function has correct permissions
2. Check the RLS policies allow insertion
3. Verify the service role key is being used

## Cost Considerations

- **Resend**: Free for 100 emails/day, then $20/month for unlimited
- **SendGrid**: Free for 100 emails/day, then $14.95/month for basic

Both provide sufficient free tier for most small to medium applications.
