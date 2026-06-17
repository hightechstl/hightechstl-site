# Adventure Nights Shopify Access Setup

Adventure Nights uses Shopify for payment and Firebase for account access.
Shopify remains the billing source of truth. Firestore stores the app-facing
entitlements that decide whether a signed-in user can play subscribed
adventures or download purchased resources.

## Access model

- Users create or sign in to a Firebase account before checkout.
- A successful subscription purchase grants 30 days of play access.
- A successful recurring billing attempt extends access by another 30 days.
- A failed or challenged billing attempt does not immediately remove access;
  the existing `activeUntil` date is allowed to run out.
- A permanent adventure purchase adds that adventure ID to
  `ownedAdventureIds` and does not expire.
- If a Shopify webhook arrives before the Firebase account exists, the
  entitlement is held in `pendingAdventureEntitlements/{email}` and claimed on
  the first `getAdventureAccess` call from a matching signed-in account.

## Firestore collections

- `adventureAccounts/{uid}`: user-facing subscription and owned adventure state.
- `pendingAdventureEntitlements/{email}`: paid access waiting for account creation.
- `shopifyCustomers/{customerId}`: Shopify customer to Firebase UID mapping.
- `shopifySubscriptionContracts/{contractId}`: contract status cache.
- `shopifyBillingAttempts/{attemptId}`: failed or challenged billing attempts.
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
ADVENTURE_SUBSCRIPTION_VARIANT_IDS="48324069458161,gid://shopify/ProductVariant/48324069458161"
ADVENTURE_PURCHASE_VARIANT_MAP='{"gid://shopify/ProductVariant/111":"gilded-archive","gid://shopify/ProductVariant/222":"ember-house"}'
ADVENTURE_SUBSCRIPTION_CHECKOUT_URL="https://www.j2crafts.com/products/adventure-nights-monthly-library"
ADVENTURE_SUBSCRIPTION_GRACE_DAYS="30"
```

`ADVENTURE_SUBSCRIPTION_VARIANT_IDS` can contain numeric REST variant IDs,
GraphQL variant GIDs, or both. `ADVENTURE_PURCHASE_VARIANT_MAP` maps Shopify
variant IDs to the internal adventure IDs used by the app.

Current Shopify draft subscription product:

- Store: J2 Crafts (`www.j2crafts.com`)
- Product: Adventure Nights Monthly Library
- Product handle: `adventure-nights-monthly-library`
- Product ID: `gid://shopify/Product/9638009569521`
- Product REST ID: `9638009569521`
- Variant ID: `gid://shopify/ProductVariant/48324069458161`
- Variant REST ID: `48324069458161`
- Variant SKU: `ADV-NIGHTS-MONTHLY`
- Draft price: `$12.00`

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
- `subscription_contracts/create`
- `subscription_contracts/update`
- `subscription_contracts/activate`
- `subscription_contracts/pause`
- `subscription_contracts/cancel`
- `subscription_contracts/fail`
- `subscription_contracts/expire`
- `subscription_billing_attempts/success`
- `subscription_billing_attempts/failure`
- `subscription_billing_attempts/challenged`

These topics cover the first paid checkout, contract creation/update, contract
lifecycle changes, renewal success, failed renewal, and 3D Secure challenge
states.

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
