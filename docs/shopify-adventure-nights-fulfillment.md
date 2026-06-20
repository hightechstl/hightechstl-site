# Shopify Adventure Nights Fulfillment

Adventure Nights uses J2 Crafts for checkout and HighTechSTL for browser play.
Each adventure is sold as an individual digital product with two editions.

## Product SKUs

- `AN-LBMH-QUICK`: Lanterns Below Marrow Hill Quick-Play Edition, variant `gid://shopify/ProductVariant/48336556425457`
- `AN-LBMH-DELUXE`: Lanterns Below Marrow Hill Deluxe Edition, variant `gid://shopify/ProductVariant/48336556458225`

Where:

- `AN` = Adventure Nights
- `LBMH` = Lanterns Below Marrow Hill
- `QUICK` = Quick-Play Edition
- `DELUXE` = Deluxe Edition

## Intended flow

```text
Customer buys on J2 Crafts
↓
Shopify sends static ZIP download
↓
Shopify webhook/order automation creates entitlement
↓
Adventure Nights backend records purchase by email
↓
Customer logs in with the same email
↓
Adventure appears in their library
↓
If automatic unlock fails, customer redeems backup code
```

## Webhook events

Listen for `orders/paid`:

- Identify the adventure and edition from SKU or variant ID.
- Create an `adventureEntitlements` document for the checkout email and paid
  line item.
- Store the edition so Deluxe can upgrade Quick-Play access.
- Generate backup unlock codes outside the static ZIP only when needed.
- Store only each code hash.
- Email or reveal the code separately if needed.

Listen for `refunds/create` and `orders/cancelled`:

- Locate entitlement by Shopify order ID and line item.
- Set status to `refunded` or `revoked`.
- Remove browser access for the related user account.
- Disable unused unlock codes.

## Variant mapping

Recommended backend mapping:

```json
{
  "gid://shopify/ProductVariant/QUICK_VARIANT_ID": {
    "adventureId": "lanterns-below-marrow-hill",
    "edition": "quick-play",
    "sku": "AN-LBMH-QUICK"
  },
  "gid://shopify/ProductVariant/DELUXE_VARIANT_ID": {
    "adventureId": "lanterns-below-marrow-hill",
    "edition": "deluxe",
    "sku": "AN-LBMH-DELUXE"
  }
}
```

Include both GraphQL GIDs and numeric REST variant IDs if webhook payloads may
arrive in either shape.

## Shopify digital files

Build Shopify-ready ZIPs with:

```sh
npm run build:adventure-products
```

Generated files:

- `dist/shopify-digital-products/Lanterns_Below_Marrow_Hill_Quick_Play_Edition.zip`
- `dist/shopify-digital-products/Lanterns_Below_Marrow_Hill_Deluxe_Edition.zip`

Attach the Quick-Play ZIP to the Quick-Play product and the Deluxe ZIP to the
Deluxe product.

## Important security note

Do not hardcode unique redeem codes into these ZIP files. Shopify sends the
same digital file to every customer. Codes must be generated per order by the
backend or a separate fulfillment/code system.
