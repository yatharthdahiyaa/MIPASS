# Add-ons

Optional integrations that the backend loads only when asked. The backend works without this
folder; a feature that needs an add-on is simply hidden when its add-on is missing or not configured.

| Add-on | What it does | Switched on by |
|---|---|---|
| [`twilio_phone`](twilio_phone/) | One-time codes and text updates to a phone, by SMS or WhatsApp (Twilio) | `PHONE_BACKEND=twilio` in `apps/backend/.env` |

## How the backend finds an add-on

`apps/backend/app/services/messaging.py` imports the package `<name>_phone` from this folder,
where `<name>` is the value of `PHONE_BACKEND` (anything other than `off` or `console`). The folder
is `apps/addons` by default; set `ADDONS_DIR` to put it elsewhere. In Docker the backend image
contains only `apps/backend`, so mount this folder (for example at `/addons`) and set
`ADDONS_DIR=/addons`.

## Writing a phone provider

Create `<name>_phone/__init__.py` exporting:

```
configured() -> bool                        credentials present, codes can be delivered
start_verification(phone, channel)          send a one-time code
check_verification(phone, code) -> bool
can_send_updates(channel) -> bool
send_text(phone, body, channel)
ProviderError(message, status, code, detail)
```

`phone` is E.164, `channel` is `"sms"` or `"whatsapp"`. Raise `ProviderError` with a message that is
safe to show a user. Keep each add-on's secrets in its own `.env` (git-ignored).

## Tests

```
cd apps/addons
python -m pytest
```
