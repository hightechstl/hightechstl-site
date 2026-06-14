const {onCall, HttpsError} = require('firebase-functions/https');
const {logger} = require('firebase-functions');
const {initializeApp} = require('firebase-admin/app');
const {getAuth} = require('firebase-admin/auth');
const {FieldValue, getFirestore} = require('firebase-admin/firestore');

initializeApp();

const OWNER_UID = 'uVQ66cTpvAVzA35wueFRgGckfCF3';
const REGION = 'us-central1';
const db = getFirestore();

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
