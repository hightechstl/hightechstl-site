# High Tech STL Service Desk Setup

The private service desk at `/admin.html` is a static dashboard backed by
Firebase Authentication and Cloud Firestore. It manages:

- client contact and service information
- trouble tickets with status, priority, category, and target date
- chronological ticket notes and status-change activity
- dashboard counts and searchable client/ticket lists
- owner-only creation and review of service desk user accounts

Use a dedicated Firebase project for High Tech STL operations rather than the
FlowSlot project. This keeps customer support data, permissions, billing, and
future retention policies separate from the product application.

## 1. Create the Firebase project

1. Open Firebase Console and create a project such as `hightechstl-operations`.
2. Add a Web app to the project.
3. Copy the displayed Firebase configuration object.
4. Replace the placeholders in `assets/js/firebase-config.js`.

Firebase web configuration is an identifier, not a server secret. Security is
provided by Authentication and `firestore.rules`.

## 2. Enable authentication

1. Open `Build > Authentication > Sign-in method`.
2. Enable `Email/Password`.
3. Open the Authentication users screen and create your administrator account.
4. Copy that user's Firebase UID.

Do not enable public account registration. The dashboard has sign-in only;
additional accounts are created by the owner from the protected Users screen.

## 3. Create Firestore and authorize the first admin

1. Open `Build > Firestore Database` and create the database in production mode.
2. Create a top-level collection named `admins`.
3. Create a document whose ID is the Firebase UID copied above.
4. Add these fields:

```json
{
  "active": true,
  "email": "your-admin-email@example.com",
  "displayName": "Joshua Hancock"
}
```

The first administrator still needs to be created manually. After the Cloud
Functions deployment below, the owner account can create additional service
desk accounts from the Users screen. That screen and its server functions are
restricted to UID `uVQ66cTpvAVzA35wueFRgGckfCF3`.

## 4. Deploy Firebase security and account functions

Cloud Functions deployment requires the Firebase project to use the Blaze
plan. The functions only run when the owner opens the Users screen or creates
an account, but Firebase requires billing to be enabled before deployment.

Install and authenticate the Firebase CLI, then select the operations project:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes,functions
```

The included rules:

- deny all unauthenticated access
- require an active `admins/{uid}` record
- prevent browser-side deletion of clients and tickets
- make ticket activity append-only
- deny access to every unspecified collection

The callable functions:

- verify the caller is signed in, is an active administrator, and has the
  exact owner UID
- create the Firebase Authentication user and matching `admins/{uid}` record
- roll back the Authentication user if the Firestore record cannot be created
- never store the temporary password in Firestore

## 5. Publish and test

Push the static site normally. GitHub Pages will publish `admin.html` with the
rest of the site. The page is unlinked and marked `noindex`, but its URL is not
a security control; Firebase rules are the security boundary.

Test this workflow after deployment:

1. Sign in at `https://hightechstl.com/admin.html`.
2. Create a client.
3. Create a ticket for that client.
4. Change its status and add a work note.
5. Sign out and confirm the dashboard data is no longer visible.
6. Try a non-admin Firebase account and confirm access is denied.

## Data handling notes

Keep passwords, private keys, full payment card data, and highly sensitive
regulated records out of client and ticket notes. Firebase already encrypts
data in transit and at rest, but this lightweight service desk is intended for
normal business contact details and operational support notes.
