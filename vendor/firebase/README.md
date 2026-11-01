# Firebase JS SDK (compat bundles)

Copied unmodified from the `firebase` npm package, version 10.14.1
(Apache-2.0, https://github.com/firebase/firebase-js-sdk/blob/main/LICENSE).

Self-hosted so the installed app can start offline and does not depend on a CDN.
`app.js` loads them on demand (only when `FIREBASE_CONFIG` is set) and falls back
to `https://www.gstatic.com/firebasejs/10.14.1/` if a file is missing.
To upgrade: `npm pack firebase@<version>` and copy the three `*-compat.js` files.
