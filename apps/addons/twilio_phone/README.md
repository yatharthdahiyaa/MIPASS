# Twilio phone add-on

Sends one-time codes (Twilio Verify) and short account updates (Twilio Messages) by SMS or WhatsApp.

## Set up
1. Twilio Console → **Verify → Services → Create new**. Copy the service SID (`VA...`).
2. Copy `.env.example` to `.env` here and fill in `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
   `TWILIO_VERIFY_SERVICE_SID`.
3. In `apps/backend/.env` set `PHONE_BACKEND=twilio` and `PHONE_CHANNEL=sms` (or `whatsapp`).
4. Restart the backend.

## Updates (optional)
Codes work with only the three values above. For text updates also set `TWILIO_SMS_FROM` (a Twilio
number) or `TWILIO_MESSAGING_SERVICE_SID`; for WhatsApp set `TWILIO_WHATSAPP_FROM` and enable the
WhatsApp channel on the Verify service.

## Twilio limits to know about
- **Trial accounts** only deliver to numbers verified in the Twilio console, and prefix messages with a notice.
- **India**: SMS to Indian numbers needs DLT registration on Twilio's side.
- **WhatsApp**: free-form messages only reach people who wrote to you in the last 24 hours; otherwise
  Twilio-approved templates are required.
