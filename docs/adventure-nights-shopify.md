# Adventure Nights Shopify Access Setup

Adventure Nights uses Shopify for payment and Firebase for account access.
Shopify remains the billing source of truth. Firestore stores the app-facing
entitlements that decide whether a signed-in user owns an adventure and can
play or download its resources.

## Access model

- Users create or sign in to a Firebase account before checkout.
- A successful adventure purchase adds that adventure ID to
  `ownedAdventureIds` and does not expire.
- If a Shopify webhook arrives before the Firebase account exists, the
  entitlement is held in `pendingAdventureEntitlements/{email}` and claimed on
  the first `getAdventureAccess` call from a matching signed-in account.

## Firestore collections

- `adventureAccounts/{uid}`: user-facing owned adventure state.
- `pendingAdventureEntitlements/{email}`: paid access waiting for account creation.
- `shopifyCustomers/{encodedCustomerId}`: Shopify customer to Firebase UID mapping.
- `shopifyWebhookEvents/{webhookId}`: webhook idempotency guard.

## Firebase configuration

Set secrets:

```sh
firebase functions:secrets:set SHOPIFY_WEBHOOK_SECRET
firebase functions:secrets:set SHOPIFY_ADMIN_ACCESS_TOKEN
```

`SHOPIFY_WEBHOOK_SECRET` must be the Shopify app client secret for the same app
that creates the webhook subscriptions. Shopify signs HTTPS webhook deliveries
with that app client secret, so a webhook created by a different app will fail
HMAC verification.

The deployed webhook also accepts a private `?token=...` URL token that matches
`SHOPIFY_WEBHOOK_SECRET`. This is useful when webhook creation is done outside
the same Shopify app that owns the client secret. Do not publish or commit the
tokenized webhook URL.

Set Firebase Functions v2 params in your deploy environment or answer the
Firebase CLI prompts during deploy:

```sh
SHOPIFY_SHOP_DOMAIN="www.j2crafts.com"
SHOPIFY_API_VERSION="2026-04"
ADVENTURE_PURCHASE_VARIANT_MAP='{"gid://shopify/ProductVariant/111":"lanterns-below-marrow-hill"}'
```

`ADVENTURE_PURCHASE_VARIANT_MAP` maps Shopify variant IDs to the internal
adventure IDs used by the app. Include both the numeric REST variant ID and the
GraphQL variant GID if your webhook payloads may use either form.

Legacy subscription params and functions may still exist in the codebase, but
the recommended Adventure Nights model is now one-time adventure purchases.

Current/next Shopify adventure product:

- Store: J2 Crafts (`www.j2crafts.com`)
- Product: Lanterns Below Marrow Hill
- Internal adventure ID: `lanterns-below-marrow-hill`
- Add the product variant ID to `ADVENTURE_PURCHASE_VARIANT_MAP`.

## Deploy

```sh
firebase deploy --only firestore:rules,firestore:indexes,functions
```

After deployment, the webhook URL will be:

```text
https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/shopifyAdventureWebhook
```

For this Firebase project, use:

```text
https://us-central1-hightechstl-operations.cloudfunctions.net/shopifyAdventureWebhook
```

If using the temporary token fallback, register the same URL with the private
`?token=...` query string from the Firebase secret setup session.

## Shopify webhook topics

Create Admin API webhook subscriptions for this URL:

- `orders/paid`

This topic is enough for one-time adventure purchases. Subscription contract
and billing attempt topics are only needed for the legacy monthly-library model.

## GraphQL mutation shape

Use the Shopify Admin GraphQL API after the Firebase function URL exists:

```graphql
mutation AdventureWebhookCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
  webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
    webhookSubscription {
      id
      topic
      format
      uri
    }
    userErrors {
      field
      message
    }
  }
}
```

Variables example:

```json
{
  "topic": "ORDERS_PAID",
  "webhookSubscription": {
    "uri": "https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/shopifyAdventureWebhook",
    "format": "JSON"
  }
}
```

Repeat with each topic enum that corresponds to the topic list above.

Or use the included helper after deployment:

```sh
SHOPIFY_SHOP_DOMAIN="your-store.myshopify.com" \
SHOPIFY_ADMIN_ACCESS_TOKEN="shpat_..." \
SHOPIFY_ADVENTURE_WEBHOOK_URL="https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/shopifyAdventureWebhook" \
node scripts/register-shopify-adventure-webhooks.mjs
```

## Checkout linking

For best account matching, send users to Shopify only after they are signed in
and include one of these values in checkout/order metadata if your checkout
flow supports it:

- `firebase_uid`
- `uid`
- `adventure_uid`

The webhook also falls back to Shopify customer ID and then order email, so
metadata is helpful but not the only path.
