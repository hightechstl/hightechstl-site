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
    const customerSnapshot = await db.collection('shopifyCustomers').doc(customerId).get();
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
  await db.collection('shopifyCustomers').doc(customerId).set({
    uid,
    email: email || '',
    updatedAt: FieldValue.serverTimestamp()
  }, {merge: true});
}

async function grantAdventureEntitlement({uid, email, customerId, subscriptionActiveUntil, ownedAdventureIds = [], source = {}}) {
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
      ...(ownedAdventureIds.length ? {ownedAdventureIds: Array.from(new Set([...(existing.ownedAdventureIds || []), ...ownedAdventureIds]))} : {})
    }, {merge: true});
  });

  await rememberShopifyCustomer({uid, email: cleanEmail, customerId});
}

async function claimPendingAdventureEntitlements(uid, email) {
  const cleanEmail = normalizeEmail(email);
  if (!uid || !cleanEmail) return;

  const pendingRef = db.collection('pendingAdventureEntitlements').doc(cleanEmail);
  const pendingSnapshot = await pendingRef.get();
  if (!pendingSnapshot.exists) return;

  const pending = pendingSnapshot.data();
  await grantAdventureEntitlement({
    uid,
    email: cleanEmail,
    subscriptionActiveUntil: timestampToDate(pending.subscriptionActiveUntil),
    ownedAdventureIds: pending.ownedAdventureIds || [],
    source: {type: 'pending-claim', email: cleanEmail}
  });
  await pendingRef.delete();
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

function orderEntitlements(order) {
  const subscriptionVariantIds = parseVariantSet(ADVENTURE_SUBSCRIPTION_VARIANT_IDS.value());
  const purchaseVariantMap = parsePurchaseVariantMap(ADVENTURE_PURCHASE_VARIANT_MAP.value());
  const adventureIds = new Set();
  let hasSubscription = false;

  for (const line of order.line_items || []) {
    const variantIds = getOrderLineVariantIds(line);
    if ([...variantIds].some((variantId) => subscriptionVariantIds.has(variantId))) {
      hasSubscription = true;
    }

    for (const variantId of variantIds) {
      const mappedAdventure = purchaseVariantMap[variantId];
      if (mappedAdventure) adventureIds.add(mappedAdventure);
    }

    const lineAdventureId = getLineProperty(line, ['adventure_id', 'adventure']);
    if (lineAdventureId) adventureIds.add(lineAdventureId);
  }

  return {hasSubscription, ownedAdventureIds: [...adventureIds]};
}

async function handleOrderPaid(order) {
  const email = getOrderEmail(order);
  const customerId = getOrderCustomerId(order);
  const hintedUid = getOrderNoteAttribute(order, ['firebase_uid', 'uid', 'adventure_uid']);
  const uid = await resolveAdventureUid({email, customerId, hintedUid});
  const {hasSubscription, ownedAdventureIds} = orderEntitlements(order);
  const graceDays = Number.parseInt(ADVENTURE_SUBSCRIPTION_GRACE_DAYS.value(), 10) || 30;

  if (!hasSubscription && ownedAdventureIds.length === 0) {
    logger.info('Shopify order paid did not contain Adventure Nights products', {
      orderId: order.admin_graphql_api_id || order.id
    });
    return;
  }

  await grantAdventureEntitlement({
    uid,
    email,
    customerId,
    subscriptionActiveUntil: hasSubscription ? addDays(new Date(), graceDays) : null,
    ownedAdventureIds,
    source: {
      type: 'orders/paid',
      orderId: order.admin_graphql_api_id || String(order.id || ''),
      name: order.name || ''
    }
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
    ownedAdventureIds: account.ownedAdventureIds || []
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

    if (['orders/paid', 'orders/create'].includes(topic)) {
      await handleOrderPaid(payload);
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
