const crypto = require('crypto');
const {onCall, onRequest, HttpsError} = require('firebase-functions/https');
const {logger} = require('firebase-functions');
const {defineSecret, defineString} = require('firebase-functions/params');
const {onSchedule} = require('firebase-functions/scheduler');
const {initializeApp} = require('firebase-admin/app');
const {getAuth} = require('firebase-admin/auth');
const {FieldValue, Timestamp, getFirestore} = require('firebase-admin/firestore');

initializeApp();

const OWNER_UID = 'uVQ66cTpvAVzA35wueFRgGckfCF3';
const REGION = 'us-central1';
const db = getFirestore();

const SHOPIFY_WEBHOOK_SECRET = defineSecret('SHOPIFY_WEBHOOK_SECRET');
const SHOPIFY_ADMIN_ACCESS_TOKEN = defineSecret('SHOPIFY_ADMIN_ACCESS_TOKEN');
const REDEEM_CODE_PEPPER = defineSecret('REDEEM_CODE_PEPPER');
const SHOPIFY_SHOP_DOMAIN = defineString('SHOPIFY_SHOP_DOMAIN', {default: ''});
const SHOPIFY_API_VERSION = defineString('SHOPIFY_API_VERSION', {default: '2026-04'});
const ADVENTURE_SUBSCRIPTION_VARIANT_IDS = defineString('ADVENTURE_SUBSCRIPTION_VARIANT_IDS', {default: ''});
const ADVENTURE_PURCHASE_VARIANT_MAP = defineString('ADVENTURE_PURCHASE_VARIANT_MAP', {default: '{}'});
const ADVENTURE_SUBSCRIPTION_CHECKOUT_URL = defineString('ADVENTURE_SUBSCRIPTION_CHECKOUT_URL', {default: ''});
const ADVENTURE_SUBSCRIPTION_GRACE_DAYS = defineString('ADVENTURE_SUBSCRIPTION_GRACE_DAYS', {default: '30'});

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function parseVariantSet(value = '') {
  return new Set(String(value).split(',').map((item) => item.trim()).filter(Boolean));
}

function parsePurchaseVariantMap(value = '{}') {
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    logger.error('Invalid ADVENTURE_PURCHASE_VARIANT_MAP JSON', error);
    return {};
  }
}


function normalizeRedeemCode(code = '') {
  return String(code).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function hashRedeemCode(code, pepperValue) {
  const normalized = normalizeRedeemCode(code);
  const pepper = String(pepperValue || '');
  if (!normalized || normalized.length < 8) {
    throw new HttpsError('invalid-argument', 'Enter a valid redeem code.');
  }
  if (!pepper) {
    throw new HttpsError('failed-precondition', 'Redeem code validation is not configured yet.');
  }
  return crypto.createHmac('sha256', pepper).update(normalized).digest('hex');
}

function generateRedeemCode() {
  return `AN-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function editionRank(edition = '') {
  const normalized = String(edition || '').toLowerCase();
  if (['deluxe', 'deluxe-edition'].includes(normalized)) return 2;
  if (['quick-play', 'quickplay', 'quick'].includes(normalized)) return 1;
  return 0;
}

function normalizeEdition(edition = '') {
  const normalized = String(edition || '').trim().toLowerCase();
  if (['deluxe', 'deluxe-edition'].includes(normalized)) return 'deluxe';
  if (['quick-play', 'quickplay', 'quick'].includes(normalized)) return 'quick-play';
  return normalized || 'quick-play';
}

function mergeAdventureEditions(existing = {}, incoming = {}) {
  const merged = {...existing};
  Object.entries(incoming || {}).forEach(([adventureId, edition]) => {
    const cleanEdition = normalizeEdition(edition);
    if (!merged[adventureId] || editionRank(cleanEdition) >= editionRank(merged[adventureId])) {
      merged[adventureId] = cleanEdition;
    }
  });
  return merged;
}

function getOrderIds(order = {}) {
  return {
    gid: String(order.admin_graphql_api_id || (order.id ? `gid://shopify/Order/${order.id}` : '') || ''),
    numeric: String(order.id || order.order_id || '').trim()
  };
}

function getRefundOrderIds(refund = {}) {
  const numeric = String(refund.order_id || refund.order?.id || '').trim();
  return {
    gid: String(refund.admin_graphql_api_order_id || refund.order?.admin_graphql_api_id || (numeric ? `gid://shopify/Order/${numeric}` : '') || ''),
    numeric
  };
}

function getLineItemId(line = {}) {
  return String(line.admin_graphql_api_id || (line.id ? `gid://shopify/LineItem/${line.id}` : '') || line.line_item_id || '').trim();
}

function lineItemIdCandidates(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return [];

  const ids = new Set([raw]);
  const match = raw.match(/^gid:\/\/shopify\/LineItem\/(.+)$/);
  if (match?.[1]) {
    ids.add(match[1]);
  } else if (/^\d+$/.test(raw)) {
    ids.add(`gid://shopify/LineItem/${raw}`);
  }

  return [...ids];
}

function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function laterDate(first, second) {
  if (!first) return second;
  if (!second) return first;
  return first.getTime() > second.getTime() ? first : second;
}

function timestampToDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function firestoreId(value = '') {
  return Buffer.from(String(value), 'utf8').toString('base64url');
}

function getOrderEmail(order = {}) {
  return normalizeEmail(
    order.email ||
    order.contact_email ||
    order.customer?.email ||
    order.billing_address?.email ||
    order.note_attributes?.find?.((item) => ['email', 'account_email'].includes(item.name))?.value ||
    ''
  );
}

function getOrderCustomerId(order = {}) {
  return String(
    order.customer?.admin_graphql_api_id ||
    order.admin_graphql_api_customer_id ||
    (order.customer?.id ? `gid://shopify/Customer/${order.customer.id}` : '') ||
    ''
  );
}

function getOrderLineVariantIds(line = {}) {
  const ids = new Set();
  if (line.variant_id) ids.add(String(line.variant_id));
  if (line.admin_graphql_api_variant_id) ids.add(String(line.admin_graphql_api_variant_id));
  if (line.variant?.id) ids.add(String(line.variant.id));
  return ids;
}

function getLineProperty(line = {}, names = []) {
  const properties = Array.isArray(line.properties) ? line.properties : [];
  const property = properties.find((item) => names.includes(String(item.name || '').toLowerCase()));
  return property?.value ? String(property.value).trim() : '';
}

function addRefundLineItemIds(ids, value) {
  lineItemIdCandidates(value).forEach((id) => ids.add(id));
}

function getRefundLineItemIds(refund = {}) {
  const ids = new Set();
  for (const refundLine of refund.refund_line_items || []) {
    addRefundLineItemIds(ids, refundLine.line_item_id);
    addRefundLineItemIds(ids, refundLine.admin_graphql_api_line_item_id);
    addRefundLineItemIds(ids, refundLine.line_item?.id);
    addRefundLineItemIds(ids, refundLine.line_item?.admin_graphql_api_id);
  }
  return ids;
}

function getOrderNoteAttribute(order = {}, names = []) {
  const attributes = Array.isArray(order.note_attributes) ? order.note_attributes : [];
  const attribute = attributes.find((item) => names.includes(String(item.name || '').toLowerCase()));
  return attribute?.value ? String(attribute.value).trim() : '';
}

async function resolveAdventureUid({email, customerId, hintedUid}) {
  if (hintedUid) {
    try {
      await getAuth().getUser(hintedUid);
      return hintedUid;
    } catch (error) {
      logger.warn('Shopify webhook included an unknown Firebase UID', {hintedUid});
    }
  }

  if (customerId) {
    const customerSnapshot = await db.collection('shopifyCustomers').doc(firestoreId(customerId)).get();
    if (customerSnapshot.exists && customerSnapshot.data()?.uid) {
      return customerSnapshot.data().uid;
    }
  }

  if (email) {
    try {
      const user = await getAuth().getUserByEmail(email);
      return user.uid;
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') {
        logger.error('Failed to resolve Adventure Nights user by email', {email, error});
      }
    }
  }

  return null;
}

async function rememberShopifyCustomer({uid, email, customerId}) {
  if (!uid || !customerId) return;
  await db.collection('shopifyCustomers').doc(firestoreId(customerId)).set({
    customerId,
    uid,
    email: email || '',
    updatedAt: FieldValue.serverTimestamp()
  }, {merge: true});
}

async function grantAdventureEntitlement({uid, email, customerId, subscriptionActiveUntil, ownedAdventureIds = [], ownedAdventureEditions = {}, source = {}}) {
  const cleanEmail = normalizeEmail(email);

  if (!uid) {
    if (!cleanEmail) {
      logger.warn('Unable to grant Adventure Nights entitlement without uid or email', source);
      return;
    }

    const pendingRef = db.collection('pendingAdventureEntitlements').doc(cleanEmail);
    await db.runTransaction(async (transaction) => {
      const pendingSnapshot = await transaction.get(pendingRef);
      const existing = pendingSnapshot.exists ? pendingSnapshot.data() : {};
      const existingDate = timestampToDate(existing.subscriptionActiveUntil);
      const activeUntilDate = laterDate(existingDate, subscriptionActiveUntil || null);

      transaction.set(pendingRef, {
        email: cleanEmail,
        subscriptionActiveUntil: activeUntilDate ? Timestamp.fromDate(activeUntilDate) : existing.subscriptionActiveUntil || null,
        ownedAdventureIds: Array.from(new Set([...(existing.ownedAdventureIds || []), ...ownedAdventureIds])),
        ownedAdventureEditions: mergeAdventureEditions(existing.ownedAdventureEditions || {}, ownedAdventureEditions),
        sources: FieldValue.arrayUnion(source),
        updatedAt: FieldValue.serverTimestamp()
      }, {merge: true});
    });
    return;
  }

  const accountRef = db.collection('adventureAccounts').doc(uid);
  await db.runTransaction(async (transaction) => {
    const accountSnapshot = await transaction.get(accountRef);
    const existing = accountSnapshot.exists ? accountSnapshot.data() : {};
    const existingDate = timestampToDate(existing.subscription?.activeUntil);
    const activeUntilDate = laterDate(existingDate, subscriptionActiveUntil || null);
    const subscriptionPatch = subscriptionActiveUntil ? {
      subscription: {
        status: 'active',
        activeUntil: Timestamp.fromDate(activeUntilDate),
        customerId: customerId || existing.subscription?.customerId || '',
        updatedAt: FieldValue.serverTimestamp(),
        source
      }
    } : {};

    transaction.set(accountRef, {
      email: cleanEmail || existing.email || '',
      updatedAt: FieldValue.serverTimestamp(),
      ...subscriptionPatch,
      ...(ownedAdventureIds.length ? {ownedAdventureIds: Array.from(new Set([...(existing.ownedAdventureIds || []), ...ownedAdventureIds]))} : {}),
      ...(Object.keys(ownedAdventureEditions).length ? {ownedAdventureEditions: mergeAdventureEditions(existing.ownedAdventureEditions || {}, ownedAdventureEditions)} : {})
    }, {merge: true});
  });

  await rememberShopifyCustomer({uid, email: cleanEmail, customerId});
}

async function claimPendingAdventureEntitlements(uid, email) {
  const cleanEmail = normalizeEmail(email);
  if (!uid || !cleanEmail) return;

  const pendingRef = db.collection('pendingAdventureEntitlements').doc(cleanEmail);
  const pendingSnapshot = await pendingRef.get();
  if (pendingSnapshot.exists) {
    const pending = pendingSnapshot.data();
    await grantAdventureEntitlement({
      uid,
      email: cleanEmail,
      subscriptionActiveUntil: timestampToDate(pending.subscriptionActiveUntil),
      ownedAdventureIds: pending.ownedAdventureIds || [],
      ownedAdventureEditions: pending.ownedAdventureEditions || {},
      source: {type: 'pending-claim', email: cleanEmail}
    });
    await pendingRef.delete();
  }

  const entitlementSnapshot = await db.collection('adventureEntitlements').where('email', '==', cleanEmail).get();
  let claimedAny = false;
  const batch = db.batch();

  entitlementSnapshot.docs.forEach((document) => {
    const entitlement = document.data();
    if (!isActiveEntitlementStatus(entitlement.status)) return;
    if (entitlement.userId && entitlement.userId !== uid) return;
    if (entitlement.userId === uid && entitlement.status === 'claimed') return;

    claimedAny = true;
    batch.set(document.ref, {
      userId: uid,
      status: 'claimed',
      claimedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, {merge: true});
  });

  if (claimedAny) {
    await batch.commit();
    await recomputeAdventureAccess({uid, email: cleanEmail});
  }
}

function verifyShopifyWebhook(request, secretValue) {
  const configuredSecret = String(secretValue || '');
  const urlToken = String(request.query.token || '');
  if (configuredSecret && urlToken && urlToken === configuredSecret) {
    return true;
  }

  const hmacHeader = request.get('x-shopify-hmac-sha256') || '';
  const rawBody = request.rawBody;

  if (!configuredSecret || !hmacHeader || !rawBody?.length) {
    return false;
  }

  const digest = crypto
    .createHmac('sha256', configuredSecret)
    .update(rawBody)
    .digest('base64');

  const expected = Buffer.from(digest, 'utf8');
  const received = Buffer.from(hmacHeader, 'utf8');
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

async function recordWebhookEvent(request, topic, payload) {
  const webhookId = request.get('x-shopify-webhook-id') || crypto.createHash('sha256').update(request.rawBody).digest('hex');
  const eventRef = db.collection('shopifyWebhookEvents').doc(webhookId);
  const eventSnapshot = await eventRef.get();

  if (eventSnapshot.exists) {
    return {duplicate: true, webhookId};
  }

  await eventRef.set({
    topic,
    shopDomain: request.get('x-shopify-shop-domain') || '',
    webhookId,
    payloadId: payload.id || payload.admin_graphql_api_id || null,
    createdAt: FieldValue.serverTimestamp()
  });
  return {duplicate: false, webhookId};
}


function lineEntitlements(order) {
  const purchaseVariantMap = parsePurchaseVariantMap(ADVENTURE_PURCHASE_VARIANT_MAP.value());
  const entitlements = [];

  for (const line of order.line_items || []) {
    const variantIds = getOrderLineVariantIds(line);
    let adventureId = getLineProperty(line, ['adventure_id', 'adventure']);
    let edition = getLineProperty(line, ['edition', 'adventure_edition']);
    let sku = String(line.sku || line.variant?.sku || '').trim();

    for (const variantId of variantIds) {
      const mappedAdventure = purchaseVariantMap[variantId];
      if (typeof mappedAdventure === 'string' && !adventureId) {
        adventureId = mappedAdventure;
      } else if (mappedAdventure?.adventureId) {
        adventureId = mappedAdventure.adventureId;
        edition = mappedAdventure.edition || edition;
        sku = mappedAdventure.sku || sku;
      }
    }

    if (!adventureId) continue;

    entitlements.push({
      adventureId,
      edition: normalizeEdition(edition),
      sku,
      lineItemId: getLineItemId(line),
      variantIds: [...variantIds],
      quantity: Number(line.quantity || 1) || 1
    });
  }

  return entitlements;
}

function entitlementDocumentId({orderId, lineItemId, adventureId}) {
  return firestoreId(['shopify', orderId || 'order', lineItemId || 'line', adventureId].join(':'));
}

async function recordAdventureEntitlement({uid, email, customerId, order, lineEntitlement, source = {}}) {
  const cleanEmail = normalizeEmail(email);
  const orderIds = getOrderIds(order);
  const docId = entitlementDocumentId({
    orderId: orderIds.gid || orderIds.numeric,
    lineItemId: lineEntitlement.lineItemId,
    adventureId: lineEntitlement.adventureId
  });
  const entitlementRef = db.collection('adventureEntitlements').doc(docId);

  await db.runTransaction(async (transaction) => {
    const entitlementSnapshot = await transaction.get(entitlementRef);
    const existing = entitlementSnapshot.exists ? entitlementSnapshot.data() : {};
    const existingStatus = String(existing.status || '').toLowerCase();
    const terminalStatus = ['refunded', 'revoked'].includes(existingStatus);
    const mergedEdition = mergeAdventureEditions(
      {[lineEntitlement.adventureId]: existing.edition || lineEntitlement.edition},
      {[lineEntitlement.adventureId]: lineEntitlement.edition}
    )[lineEntitlement.adventureId];

    transaction.set(entitlementRef, {
      email: cleanEmail || existing.email || '',
      userId: uid || existing.userId || null,
      customerId: customerId || existing.customerId || '',
      adventureId: lineEntitlement.adventureId,
      edition: normalizeEdition(mergedEdition),
      source: 'shopify',
      shopifyOrderId: orderIds.gid || existing.shopifyOrderId || '',
      shopifyOrderNumericId: orderIds.numeric || existing.shopifyOrderNumericId || '',
      shopifyLineItemId: lineEntitlement.lineItemId || existing.shopifyLineItemId || '',
      shopifyVariantIds: lineEntitlement.variantIds || existing.shopifyVariantIds || [],
      sku: lineEntitlement.sku || existing.sku || '',
      quantity: lineEntitlement.quantity || existing.quantity || 1,
      status: terminalStatus ? existing.status : (uid || existing.userId ? 'claimed' : existing.status || 'unclaimed'),
      sourceEvent: source,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: existing.createdAt || FieldValue.serverTimestamp()
    }, {merge: true});
  });

  return {docId, ref: entitlementRef};
}

function isActiveEntitlementStatus(status = '') {
  return !['revoked', 'refunded'].includes(String(status || '').toLowerCase());
}

async function activeEntitlementsFor({uid, email}) {
  const cleanEmail = normalizeEmail(email);
  const byId = new Map();
  if (uid) {
    const snapshot = await db.collection('adventureEntitlements').where('userId', '==', uid).get();
    snapshot.docs.forEach((document) => byId.set(document.id, document.data()));
  }
  if (cleanEmail) {
    const snapshot = await db.collection('adventureEntitlements').where('email', '==', cleanEmail).get();
    snapshot.docs.forEach((document) => byId.set(document.id, document.data()));
  }
  return [...byId.values()].filter((entitlement) => isActiveEntitlementStatus(entitlement.status));
}

async function recomputeAdventureAccess({uid, email}) {
  const cleanEmail = normalizeEmail(email);
  const entitlements = await activeEntitlementsFor({uid, email: cleanEmail});
  const ownedAdventureIds = [];
  const ownedAdventureEditions = {};

  entitlements.forEach((entitlement) => {
    if (!entitlement.adventureId) return;
    if (!ownedAdventureIds.includes(entitlement.adventureId)) ownedAdventureIds.push(entitlement.adventureId);
    Object.assign(ownedAdventureEditions, mergeAdventureEditions(ownedAdventureEditions, {
      [entitlement.adventureId]: entitlement.edition || 'quick-play'
    }));
  });

  if (uid) {
    await db.collection('adventureAccounts').doc(uid).set({
      email: cleanEmail,
      ownedAdventureIds,
      ownedAdventureEditions,
      updatedAt: FieldValue.serverTimestamp()
    }, {merge: true});
  }

  if (cleanEmail && !uid) {
    const pendingRef = db.collection('pendingAdventureEntitlements').doc(cleanEmail);
    if (ownedAdventureIds.length) {
      await pendingRef.set({
        email: cleanEmail,
        ownedAdventureIds,
        ownedAdventureEditions,
        updatedAt: FieldValue.serverTimestamp()
      }, {merge: true});
    } else {
      await pendingRef.delete().catch(() => {});
    }
  } else if (cleanEmail && uid) {
    await db.collection('pendingAdventureEntitlements').doc(cleanEmail).delete().catch(() => {});
  }
}

async function entitlementsForOrderIds(orderIds = {}) {
  const byId = new Map();
  const queries = [];
  if (orderIds.gid) queries.push(db.collection('adventureEntitlements').where('shopifyOrderId', '==', orderIds.gid).get());
  if (orderIds.numeric) queries.push(db.collection('adventureEntitlements').where('shopifyOrderNumericId', '==', orderIds.numeric).get());

  const snapshots = await Promise.all(queries);
  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((document) => byId.set(document.id, document));
  });

  return [...byId.values()];
}

function entitlementMatchesLineItem(entitlement = {}, lineItemIds = null) {
  if (!lineItemIds || lineItemIds.size === 0) return true;
  return lineItemIdCandidates(entitlement.shopifyLineItemId).some((id) => lineItemIds.has(id));
}

function targetKeyForEntitlement(entitlement = {}) {
  const uid = String(entitlement.userId || '').trim();
  const email = normalizeEmail(entitlement.email || '');
  if (!uid && !email) return '';
  return `${uid}|${email}`;
}

async function disableUnlockCodesForEntitlements(entitlementDocs, status, reason) {
  const snapshots = await Promise.all(entitlementDocs.map((document) => (
    db.collection('adventureUnlockCodes').where('entitlementId', '==', document.id).get()
  )));
  const batch = db.batch();
  let updateCount = 0;

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((document) => {
      const code = document.data();
      if (['refunded', 'revoked'].includes(String(code.status || '').toLowerCase())) return;
      updateCount += 1;
      batch.set(document.ref, {
        status,
        disabledReason: reason,
        disabledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, {merge: true});
    });
  });

  if (updateCount) await batch.commit();
  return updateCount;
}

async function revokeAdventureEntitlementsForOrder({orderIds, status, reason, lineItemIds = null, source = {}}) {
  const entitlementDocs = await entitlementsForOrderIds(orderIds);
  const matchingDocs = entitlementDocs.filter((document) => {
    const entitlement = document.data();
    return isActiveEntitlementStatus(entitlement.status) && entitlementMatchesLineItem(entitlement, lineItemIds);
  });

  if (!matchingDocs.length) return {revoked: 0, disabledCodes: 0};

  const targets = new Map();
  const batch = db.batch();

  matchingDocs.forEach((document) => {
    const entitlement = document.data();
    const key = targetKeyForEntitlement(entitlement);
    if (key) {
      targets.set(key, {
        uid: entitlement.userId || '',
        email: normalizeEmail(entitlement.email || '')
      });
    }

    batch.set(document.ref, {
      status,
      revokeReason: reason,
      revokedBy: source.type || '',
      revokedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, {merge: true});
  });

  await batch.commit();
  const disabledCodes = await disableUnlockCodesForEntitlements(matchingDocs, status, reason);
  await Promise.all([...targets.values()].map((target) => recomputeAdventureAccess(target)));

  return {revoked: matchingDocs.length, disabledCodes};
}

function orderEntitlements(order) {
  const subscriptionVariantIds = parseVariantSet(ADVENTURE_SUBSCRIPTION_VARIANT_IDS.value());
  const purchaseVariantMap = parsePurchaseVariantMap(ADVENTURE_PURCHASE_VARIANT_MAP.value());
  const adventureIds = new Set();
  const adventureEditions = {};
  let hasSubscription = false;

  for (const line of order.line_items || []) {
    const variantIds = getOrderLineVariantIds(line);
    if ([...variantIds].some((variantId) => subscriptionVariantIds.has(variantId))) {
      hasSubscription = true;
    }

    for (const variantId of variantIds) {
      const mappedAdventure = purchaseVariantMap[variantId];
      if (typeof mappedAdventure === 'string') {
        adventureIds.add(mappedAdventure);
      } else if (mappedAdventure?.adventureId) {
        adventureIds.add(mappedAdventure.adventureId);
        if (mappedAdventure.edition) adventureEditions[mappedAdventure.adventureId] = mappedAdventure.edition;
      }
    }

    const lineAdventureId = getLineProperty(line, ['adventure_id', 'adventure']);
    const lineEdition = getLineProperty(line, ['edition', 'adventure_edition']);
    if (lineAdventureId) {
      adventureIds.add(lineAdventureId);
      if (lineEdition) adventureEditions[lineAdventureId] = lineEdition;
    }
  }

  return {hasSubscription, ownedAdventureIds: [...adventureIds], ownedAdventureEditions: adventureEditions};
}

async function handleOrderPaid(order) {
  const email = getOrderEmail(order);
  const customerId = getOrderCustomerId(order);
  const hintedUid = getOrderNoteAttribute(order, ['firebase_uid', 'uid', 'adventure_uid']);
  const uid = await resolveAdventureUid({email, customerId, hintedUid});
  const {hasSubscription, ownedAdventureIds, ownedAdventureEditions} = orderEntitlements(order);
  const paidLineEntitlements = lineEntitlements(order);
  const paidAdventureIds = [];
  const paidAdventureEditions = {};
  const graceDays = Number.parseInt(ADVENTURE_SUBSCRIPTION_GRACE_DAYS.value(), 10) || 30;

  paidLineEntitlements.forEach((lineEntitlement) => {
    if (!paidAdventureIds.includes(lineEntitlement.adventureId)) {
      paidAdventureIds.push(lineEntitlement.adventureId);
    }
    Object.assign(paidAdventureEditions, mergeAdventureEditions(paidAdventureEditions, {
      [lineEntitlement.adventureId]: lineEntitlement.edition
    }));
  });

  const aggregateAdventureIds = paidLineEntitlements.length ? paidAdventureIds : ownedAdventureIds;
  const aggregateAdventureEditions = paidLineEntitlements.length ? paidAdventureEditions : ownedAdventureEditions;

  if (!hasSubscription && aggregateAdventureIds.length === 0) {
    logger.info('Shopify order paid did not contain Adventure Nights products', {
      orderId: order.admin_graphql_api_id || order.id
    });
    return;
  }

  await Promise.all(paidLineEntitlements.map((lineEntitlement) => recordAdventureEntitlement({
    uid,
    email,
    customerId,
    order,
    lineEntitlement,
    source: {
      type: 'orders/paid',
      orderId: order.admin_graphql_api_id || String(order.id || ''),
      name: order.name || ''
    }
  })));

  await grantAdventureEntitlement({
    uid,
    email,
    customerId,
    subscriptionActiveUntil: hasSubscription ? addDays(new Date(), graceDays) : null,
    ownedAdventureIds: aggregateAdventureIds,
    ownedAdventureEditions: aggregateAdventureEditions,
    source: {
      type: 'orders/paid',
      orderId: order.admin_graphql_api_id || String(order.id || ''),
      name: order.name || ''
    }
  });

  if (paidLineEntitlements.length) {
    await recomputeAdventureAccess({uid, email});
  }
}

async function handleOrderCancelled(order) {
  const orderIds = getOrderIds(order);
  const result = await revokeAdventureEntitlementsForOrder({
    orderIds,
    status: 'revoked',
    reason: order.cancel_reason || 'Shopify order cancelled',
    source: {
      type: 'orders/cancelled',
      orderId: orderIds.gid || orderIds.numeric,
      name: order.name || ''
    }
  });

  logger.info('Processed Adventure Nights order cancellation', {
    orderId: orderIds.gid || orderIds.numeric,
    revoked: result.revoked,
    disabledCodes: result.disabledCodes
  });
}

async function handleRefundCreated(refund) {
  const orderIds = getRefundOrderIds(refund);
  const lineItemIds = getRefundLineItemIds(refund);

  if (!lineItemIds.size) {
    logger.info('Shopify refund did not contain line items; Adventure Nights access unchanged.', {
      refundId: refund.admin_graphql_api_id || refund.id || '',
      orderId: orderIds.gid || orderIds.numeric
    });
    return;
  }

  const result = await revokeAdventureEntitlementsForOrder({
    orderIds,
    lineItemIds,
    status: 'refunded',
    reason: refund.note || 'Shopify refund created',
    source: {
      type: 'refunds/create',
      refundId: refund.admin_graphql_api_id || String(refund.id || ''),
      orderId: orderIds.gid || orderIds.numeric
    }
  });

  logger.info('Processed Adventure Nights refund', {
    refundId: refund.admin_graphql_api_id || refund.id || '',
    orderId: orderIds.gid || orderIds.numeric,
    refundedLineItems: lineItemIds.size,
    revoked: result.revoked,
    disabledCodes: result.disabledCodes
  });
}

async function handleSubscriptionContract(contract) {
  const customerId = String(contract.admin_graphql_api_customer_id || (contract.customer_id ? `gid://shopify/Customer/${contract.customer_id}` : ''));
  const contractId = String(contract.admin_graphql_api_id || (contract.id ? `gid://shopify/SubscriptionContract/${contract.id}` : ''));
  const originOrderId = String(contract.admin_graphql_api_origin_order_id || contract.origin_order_id || '');
  const status = String(contract.status || '').toLowerCase();
  const uid = await resolveAdventureUid({email: '', customerId});

  await db.collection('shopifySubscriptionContracts').doc(contractId || String(contract.id)).set({
    uid: uid || '',
    customerId,
    contractId,
    originOrderId,
    status,
    billingPolicy: contract.billing_policy || null,
    deliveryPolicy: contract.delivery_policy || null,
    updatedAt: FieldValue.serverTimestamp()
  }, {merge: true});

  if (uid && ['cancelled', 'expired', 'paused', 'failed'].includes(status)) {
    await db.collection('adventureAccounts').doc(uid).set({
      subscription: {
        status,
        customerId,
        contractId,
        updatedAt: FieldValue.serverTimestamp()
      },
      updatedAt: FieldValue.serverTimestamp()
    }, {merge: true});
  }
}

async function handleBillingAttempt(payload, status) {
  const contractId = String(payload.admin_graphql_api_subscription_contract_id || (payload.subscription_contract_id ? `gid://shopify/SubscriptionContract/${payload.subscription_contract_id}` : ''));
  const contractSnapshot = contractId ? await db.collection('shopifySubscriptionContracts').doc(contractId).get() : null;
  const uid = contractSnapshot?.exists ? contractSnapshot.data()?.uid : '';
  const customerId = contractSnapshot?.exists ? contractSnapshot.data()?.customerId : '';
  const graceDays = Number.parseInt(ADVENTURE_SUBSCRIPTION_GRACE_DAYS.value(), 10) || 30;

  if (status === 'success' && uid) {
    await grantAdventureEntitlement({
      uid,
      email: '',
      customerId,
      subscriptionActiveUntil: addDays(new Date(), graceDays),
      source: {
        type: 'subscription_billing_attempts/success',
        contractId,
        orderId: payload.admin_graphql_api_order_id || String(payload.order_id || '')
      }
    });
    return;
  }

  if (uid) {
    await db.collection('adventureAccounts').doc(uid).set({
      subscription: {
        status,
        customerId,
        contractId,
        lastBillingError: payload.error_message || payload.error_code || '',
        updatedAt: FieldValue.serverTimestamp()
      },
      updatedAt: FieldValue.serverTimestamp()
    }, {merge: true});
  }

  await db.collection('shopifyBillingAttempts').add({
    contractId,
    status,
    orderId: payload.admin_graphql_api_order_id || String(payload.order_id || ''),
    errorMessage: payload.error_message || '',
    errorCode: payload.error_code || '',
    createdAt: FieldValue.serverTimestamp()
  });
}

async function requireAccountManager(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to manage service desk accounts.');
  }

  if (request.auth.uid !== OWNER_UID) {
    throw new HttpsError('permission-denied', 'Only the service desk owner can manage accounts.');
  }

  const adminSnapshot = await db.collection('admins').doc(request.auth.uid).get();
  if (!adminSnapshot.exists || adminSnapshot.data()?.active !== true) {
    throw new HttpsError('permission-denied', 'This administrator account is not active.');
  }
}

function validateAccountInput(data = {}) {
  const displayName = typeof data.displayName === 'string' ? data.displayName.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const password = typeof data.password === 'string' ? data.password : '';
  const active = data.active !== false;

  if (!displayName || displayName.length > 100) {
    throw new HttpsError('invalid-argument', 'Enter a name no longer than 100 characters.');
  }
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  }
  if (password.length < 12 || password.length > 128) {
    throw new HttpsError('invalid-argument', 'The temporary password must be 12 to 128 characters.');
  }

  return {displayName, email, password, active};
}

exports.getServiceDeskUsers = onCall({region: REGION, invoker: 'public'}, async (request) => {
  await requireAccountManager(request);

  const [adminSnapshot, authResult] = await Promise.all([
    db.collection('admins').get(),
    getAuth().listUsers(1000)
  ]);
  const admins = new Map(adminSnapshot.docs.map((document) => [document.id, document.data()]));

  const users = authResult.users
    .filter((user) => admins.has(user.uid))
    .map((user) => {
      const admin = admins.get(user.uid);
      return {
        uid: user.uid,
        email: user.email || admin.email || '',
        displayName: user.displayName || admin.displayName || '',
        active: admin.active === true,
        disabled: user.disabled,
        createdAt: user.metadata.creationTime || null,
        lastSignInAt: user.metadata.lastSignInTime || null
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));

  return {users};
});

exports.createServiceDeskUser = onCall({region: REGION, invoker: 'public'}, async (request) => {
  await requireAccountManager(request);
  const account = validateAccountInput(request.data);
  let userRecord;

  try {
    userRecord = await getAuth().createUser({
      email: account.email,
      password: account.password,
      displayName: account.displayName,
      emailVerified: false,
      disabled: false
    });

    await db.collection('admins').doc(userRecord.uid).set({
      active: account.active,
      email: account.email,
      displayName: account.displayName,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: request.auth.uid
    });

    logger.info('Service desk account created', {
      createdUid: userRecord.uid,
      createdEmail: account.email,
      createdBy: request.auth.uid
    });

    return {uid: userRecord.uid, email: account.email};
  } catch (error) {
    if (userRecord) {
      try {
        await getAuth().deleteUser(userRecord.uid);
      } catch (rollbackError) {
        logger.error('Failed to roll back Authentication user', {
          uid: userRecord.uid,
          error: rollbackError
        });
      }
    }

    if (error?.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'An account with that email already exists.');
    }
    if (['auth/invalid-email', 'auth/invalid-password'].includes(error?.code)) {
      throw new HttpsError('invalid-argument', error.message);
    }

    logger.error('Failed to create service desk account', error);
    throw new HttpsError('internal', 'The account could not be created. Try again.');
  }
});

exports.getAdventureAccess = onCall({region: REGION, invoker: 'public'}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Create an account or sign in to view Adventure Nights access.');
  }

  const user = await getAuth().getUser(request.auth.uid);
  const email = normalizeEmail(user.email || request.auth.token.email || '');
  await claimPendingAdventureEntitlements(request.auth.uid, email);

  const accountSnapshot = await db.collection('adventureAccounts').doc(request.auth.uid).get();
  const account = accountSnapshot.exists ? accountSnapshot.data() : {};
  const activeUntil = timestampToDate(account.subscription?.activeUntil);
  const now = new Date();
  const subscriptionActive = Boolean(activeUntil && activeUntil.getTime() > now.getTime() && account.subscription?.status !== 'cancelled');

  return {
    email,
    subscription: {
      active: subscriptionActive,
      status: subscriptionActive ? 'active' : account.subscription?.status || 'none',
      activeUntil: activeUntil ? activeUntil.toISOString() : null,
      checkoutUrl: ADVENTURE_SUBSCRIPTION_CHECKOUT_URL.value() || null
    },
    ownedAdventureIds: account.ownedAdventureIds || [],
    ownedAdventureEditions: account.ownedAdventureEditions || {}
  };
});

exports.redeemAdventureCode = onCall({
  region: REGION,
  invoker: 'public',
  secrets: [REDEEM_CODE_PEPPER]
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in or create an Adventure Nights account before redeeming a code.');
  }

  const codeHash = hashRedeemCode(request.data?.code, REDEEM_CODE_PEPPER.value());
  const user = await getAuth().getUser(request.auth.uid);
  const authEmail = normalizeEmail(user.email || request.auth.token.email || request.data?.email || '');
  const codeRef = db.collection('adventureUnlockCodes').doc(codeHash);

  const redeemed = await db.runTransaction(async (transaction) => {
    const codeSnapshot = await transaction.get(codeRef);
    if (!codeSnapshot.exists) {
      throw new HttpsError('not-found', 'That redeem code was not found.');
    }

    const code = codeSnapshot.data();
    const status = String(code.status || 'active').toLowerCase();
    const usedByUserIds = new Set(Array.isArray(code.usedByUserIds) ? code.usedByUserIds : []);
    if (code.usedByUserId) usedByUserIds.add(code.usedByUserId);

    const alreadyRedeemedByUser = usedByUserIds.has(request.auth.uid);
    if (['refunded', 'revoked', 'disabled'].includes(status)) {
      throw new HttpsError('failed-precondition', 'That redeem code is no longer active.');
    }
    if (status === 'used' && !alreadyRedeemedByUser) {
      throw new HttpsError('failed-precondition', 'That redeem code has already been used.');
    }

    const maxUses = Math.max(1, Number.parseInt(code.maxUses, 10) || 1);
    const useCount = Number.parseInt(code.useCount, 10) || 0;
    if (!alreadyRedeemedByUser && useCount >= maxUses) {
      throw new HttpsError('failed-precondition', 'That redeem code has already been used.');
    }

    const entitlementId = String(code.entitlementId || firestoreId(['redeem-code', codeHash, request.auth.uid].join(':')));
    const entitlementRef = db.collection('adventureEntitlements').doc(entitlementId);
    const entitlementSnapshot = await transaction.get(entitlementRef);
    const entitlement = entitlementSnapshot.exists ? entitlementSnapshot.data() : {};

    if (!isActiveEntitlementStatus(entitlement.status)) {
      throw new HttpsError('failed-precondition', 'The purchase attached to that code is no longer active.');
    }
    if (entitlement.userId && entitlement.userId !== request.auth.uid && !alreadyRedeemedByUser) {
      throw new HttpsError('failed-precondition', 'That purchase has already been attached to another account.');
    }

    const adventureId = String(code.adventureId || entitlement.adventureId || '').trim();
    if (!adventureId) {
      throw new HttpsError('failed-precondition', 'That redeem code is missing an adventure assignment.');
    }

    const edition = normalizeEdition(code.edition || entitlement.edition || 'quick-play');
    const entitlementEmail = normalizeEmail(entitlement.email || code.email || authEmail);
    const nextUseCount = alreadyRedeemedByUser ? useCount : useCount + 1;
    const nextStatus = nextUseCount >= maxUses ? 'used' : 'active';

    transaction.set(entitlementRef, {
      email: entitlementEmail || authEmail,
      userId: request.auth.uid,
      claimedEmail: authEmail,
      adventureId,
      edition,
      source: entitlement.source || 'redeem-code',
      status: 'claimed',
      claimedAt: entitlement.claimedAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: entitlement.createdAt || FieldValue.serverTimestamp()
    }, {merge: true});

    transaction.set(codeRef, {
      entitlementId,
      status: nextStatus,
      useCount: nextUseCount,
      usedByUserId: code.usedByUserId || request.auth.uid,
      usedByUserIds: FieldValue.arrayUnion(request.auth.uid),
      usedByEmail: authEmail,
      redemptions: FieldValue.arrayUnion({
        uid: request.auth.uid,
        email: authEmail,
        redeemedAt: new Date().toISOString()
      }),
      usedAt: code.usedAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, {merge: true});

    return {adventureId, edition, email: authEmail};
  });

  await recomputeAdventureAccess({uid: request.auth.uid, email: redeemed.email});

  logger.info('Adventure Nights redeem code claimed', {
    uid: request.auth.uid,
    adventureId: redeemed.adventureId,
    edition: redeemed.edition
  });

  return {
    ok: true,
    adventureId: redeemed.adventureId,
    edition: redeemed.edition
  };
});

exports.createAdventureRedeemCode = onCall({
  region: REGION,
  invoker: 'public',
  secrets: [REDEEM_CODE_PEPPER]
}, async (request) => {
  await requireAccountManager(request);

  const adventureId = String(request.data?.adventureId || '').trim();
  if (!/^[a-z0-9-]{3,80}$/.test(adventureId)) {
    throw new HttpsError('invalid-argument', 'Enter a valid adventure ID.');
  }

  const edition = normalizeEdition(request.data?.edition || 'quick-play');
  const email = normalizeEmail(request.data?.email || '');
  const maxUses = Math.max(1, Math.min(50, Number.parseInt(request.data?.maxUses, 10) || 1));
  const plainCode = request.data?.code ? String(request.data.code).trim() : generateRedeemCode();
  const codeHash = hashRedeemCode(plainCode, REDEEM_CODE_PEPPER.value());
  const codeRef = db.collection('adventureUnlockCodes').doc(codeHash);
  let entitlementId = String(request.data?.entitlementId || '').trim();
  let entitlementRef = null;

  if (!entitlementId && email) {
    entitlementId = firestoreId(['manual-redeem-code', email, adventureId, edition].join(':'));
  }
  if (entitlementId) {
    entitlementRef = db.collection('adventureEntitlements').doc(entitlementId);
  }

  await db.runTransaction(async (transaction) => {
    const codeSnapshot = await transaction.get(codeRef);
    if (codeSnapshot.exists) {
      throw new HttpsError('already-exists', 'That redeem code already exists.');
    }

    if (entitlementRef) {
      const entitlementSnapshot = await transaction.get(entitlementRef);
      const existing = entitlementSnapshot.exists ? entitlementSnapshot.data() : {};
      transaction.set(entitlementRef, {
        email: email || existing.email || '',
        userId: existing.userId || null,
        adventureId,
        edition: mergeAdventureEditions({[adventureId]: existing.edition || edition}, {[adventureId]: edition})[adventureId],
        source: existing.source || 'manual-redeem-code',
        status: existing.status || 'unclaimed',
        sourceEvent: {
          type: 'manual-redeem-code',
          createdBy: request.auth.uid
        },
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: existing.createdAt || FieldValue.serverTimestamp()
      }, {merge: true});
    }

    transaction.set(codeRef, {
      codeHash,
      adventureId,
      edition,
      email,
      entitlementId,
      maxUses,
      useCount: 0,
      status: 'active',
      createdBy: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  logger.info('Adventure Nights redeem code created', {
    createdBy: request.auth.uid,
    adventureId,
    edition,
    hasEmail: Boolean(email)
  });

  return {
    code: plainCode,
    adventureId,
    edition,
    entitlementId: entitlementId || null,
    maxUses
  };
});

exports.shopifyAdventureWebhook = onRequest({
  region: REGION,
  invoker: 'public',
  secrets: [SHOPIFY_WEBHOOK_SECRET]
}, async (request, response) => {
  if (request.method !== 'POST') {
    response.set('Allow', 'POST').status(405).send('Method not allowed');
    return;
  }

  if (!verifyShopifyWebhook(request, SHOPIFY_WEBHOOK_SECRET.value())) {
    logger.warn('Rejected Shopify webhook with invalid HMAC', {
      topic: request.get('x-shopify-topic') || '',
      shopDomain: request.get('x-shopify-shop-domain') || ''
    });
    response.status(401).send('Invalid webhook signature');
    return;
  }

  const topic = String(request.get('x-shopify-topic') || '').toLowerCase();
  let payload;

  try {
    payload = JSON.parse(request.rawBody.toString('utf8'));
  } catch (error) {
    logger.error('Unable to parse Shopify webhook JSON', error);
    response.status(400).send('Invalid JSON');
    return;
  }

  try {
    const event = await recordWebhookEvent(request, topic, payload);
    if (event.duplicate) {
      response.status(200).send('Duplicate ignored');
      return;
    }

    if (topic === 'orders/paid' || (topic === 'orders/create' && String(payload.financial_status || '').toLowerCase() === 'paid')) {
      await handleOrderPaid(payload);
    } else if (topic === 'orders/cancelled') {
      await handleOrderCancelled(payload);
    } else if (topic === 'refunds/create') {
      await handleRefundCreated(payload);
    } else if ([
      'subscription_contracts/create',
      'subscription_contracts/update',
      'subscription_contracts/activate',
      'subscription_contracts/pause',
      'subscription_contracts/cancel',
      'subscription_contracts/fail',
      'subscription_contracts/expire'
    ].includes(topic)) {
      await handleSubscriptionContract(payload);
    } else if (topic === 'subscription_billing_attempts/success') {
      await handleBillingAttempt(payload, 'success');
    } else if (topic === 'subscription_billing_attempts/failure') {
      await handleBillingAttempt(payload, 'payment_failed');
    } else if (topic === 'subscription_billing_attempts/challenged') {
      await handleBillingAttempt(payload, 'payment_challenged');
    } else {
      logger.info('Unhandled Shopify webhook topic', {topic});
    }

    response.status(200).send('OK');
  } catch (error) {
    logger.error('Failed to process Shopify Adventure Nights webhook', {topic, error});
    response.status(500).send('Webhook processing failed');
  }
});

exports.expireAdventureSubscriptions = onSchedule({
  region: REGION,
  schedule: 'every 24 hours',
  timeZone: 'America/Chicago'
}, async () => {
  const now = Timestamp.now();
  const expiredSnapshot = await db.collection('adventureAccounts')
    .where('subscription.status', '==', 'active')
    .where('subscription.activeUntil', '<=', now)
    .limit(200)
    .get();

  if (expiredSnapshot.empty) {
    logger.info('No Adventure Nights subscriptions to expire.');
    return;
  }

  const batch = db.batch();
  expiredSnapshot.docs.forEach((document) => {
    batch.set(document.ref, {
      subscription: {
        status: 'expired',
        updatedAt: FieldValue.serverTimestamp()
      },
      updatedAt: FieldValue.serverTimestamp()
    }, {merge: true});
  });

  await batch.commit();
  logger.info('Expired Adventure Nights subscription access', {count: expiredSnapshot.size});
});

exports.reconcileAdventureSubscriptions = onSchedule({
  region: REGION,
  schedule: 'every 24 hours',
  timeZone: 'America/Chicago',
  secrets: [SHOPIFY_ADMIN_ACCESS_TOKEN]
}, async () => {
  const shopDomain = SHOPIFY_SHOP_DOMAIN.value();
  const adminToken = SHOPIFY_ADMIN_ACCESS_TOKEN.value();

  if (!shopDomain || !adminToken) {
    logger.warn('Skipping Shopify reconciliation; SHOPIFY_SHOP_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN is missing.');
    return;
  }

  const staleSnapshot = await db.collection('shopifySubscriptionContracts')
    .where('status', '==', 'active')
    .limit(50)
    .get();

  if (staleSnapshot.empty) {
    logger.info('No Shopify subscription contracts to reconcile.');
    return;
  }

  await Promise.all(staleSnapshot.docs.map(async (document) => {
    const contract = document.data();
    if (!contract.contractId) return;

    const query = `
      query AdventureSubscriptionContract($id: ID!) {
        subscriptionContract(id: $id) {
          id
          status
          customer { id email }
        }
      }
    `;

    const result = await fetch(`https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION.value()}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': adminToken
      },
      body: JSON.stringify({query, variables: {id: contract.contractId}})
    });

    if (!result.ok) {
      logger.warn('Shopify reconciliation query failed', {
        contractId: contract.contractId,
        status: result.status
      });
      return;
    }

    const body = await result.json();
    const current = body.data?.subscriptionContract;
    if (!current) return;

    const currentStatus = String(current.status || '').toLowerCase();
    await document.ref.set({
      status: currentStatus,
      customerId: current.customer?.id || contract.customerId || '',
      email: normalizeEmail(current.customer?.email || ''),
      reconciledAt: FieldValue.serverTimestamp()
    }, {merge: true});

    if (contract.uid && ['cancelled', 'expired', 'paused', 'failed'].includes(currentStatus)) {
      await db.collection('adventureAccounts').doc(contract.uid).set({
        subscription: {
          status: currentStatus,
          contractId: contract.contractId,
          customerId: current.customer?.id || contract.customerId || '',
          updatedAt: FieldValue.serverTimestamp()
        },
        updatedAt: FieldValue.serverTimestamp()
      }, {merge: true});
    }
  }));
});
