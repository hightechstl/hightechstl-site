# Adventure Nights Entitlement Model

Adventure Nights adventures are sold individually on J2 Crafts. Browser access
is granted by entitlement records, not by unlock codes embedded in static ZIP
files.

## Core rule

A Shopify digital product ZIP is the same file for every customer. Do not put a
unique unlock or redeem code directly inside the ZIP. Generate codes after
purchase in the backend or in a code management system, then email or reveal
the code separately.

## Recommended records

Users:

```json
{
  "id": "user_123",
  "email": "customer@example.com"
}
```

Entitlements:

```json
{
  "id": "ent_123",
  "email": "customer@example.com",
  "userId": null,
  "adventureId": "lanterns-below-marrow-hill",
  "edition": "deluxe",
  "source": "shopify",
  "shopifyOrderId": "123456789",
  "status": "unclaimed",
  "createdAt": "2026-06-19T00:00:00.000Z"
}
```

Unlock codes:

```json
{
  "codeHash": "hashed-code-value",
  "adventureId": "lanterns-below-marrow-hill",
  "edition": "deluxe",
  "entitlementId": "ent_123",
  "maxUses": 1,
  "usedByUserId": null,
  "status": "active"
}
```

## Statuses

- `unclaimed`: purchase exists by email, but no user account has claimed it.
- `claimed`: entitlement is attached to a user account.
- `revoked`: access was manually removed or disabled.
- `refunded`: Shopify refund/cancel flow removed access.

## Behavior

- A purchase belongs first to the checkout email address.
- A customer can buy first and create an Adventure Nights account later.
- When a user signs in with a matching email, unclaimed entitlements attach to
  that account.
- If the customer uses a different email, they can redeem with a backup code.
- Paid unlocks should not expire by default.
- Refunds should revoke browser access and disable unused codes.
- Store only hashed unlock codes. Never store plain codes after generation.

## Edition handling

Each entitlement should include `edition`.

- `quick-play`: unlocks complete gameplay, simple map/tokens, and core browser
  play.
- `deluxe`: unlocks everything in Quick-Play plus premium scene art, detailed
  asset downloads, and enhanced browser presentation.

If a customer buys Deluxe after Quick-Play, upgrade the existing entitlement
instead of creating conflicting records.

## Static site limitation

The current GitHub Pages style build can hide or show UI based on Firebase
access, but public files under `public/` are still directly reachable. True
paid content protection requires one of these:

- move paid JSON/assets behind Firebase Storage security rules;
- serve paid content through Cloud Functions after entitlement checks;
- issue short-lived signed download URLs for ZIPs/assets.
