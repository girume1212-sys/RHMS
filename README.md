# RHMS
Request Handling Management System

## Google OAuth setup

If Google sign-in shows an "origin_mismatch" error, the app is running from a browser origin that is not registered in the Google OAuth client.

Use these steps:

1. Open Google Cloud Console.
2. Go to APIs & Services > Credentials.
3. Open the OAuth 2.0 Client ID used by RHMS.
4. For this project's local frontend, add `http://localhost:3000` under Authorized JavaScript origins. Add `http://127.0.0.1:3000` only if you open RHMS using that address.
5. Keep the origin exact: do not add a path, trailing slash, or URL with a route.
6. Use the same OAuth Client ID in all applicable environment files:
   - `client/.env.development` for `npm start` / `npm run dev:client` (CRA development server; configured for `localhost:3000`)
   - `client/.env` for `npm run build` / `npm run serve`
   - `server/.env` for backend ID-token verification
   Set `REACT_APP_GOOGLE_CLIENT_ID` in the client files and `GOOGLE_CLIENT_ID` in the server file.
7. Restart the development server and backend after changing their environment values. Rebuild the client before serving a production build.

Common causes of this error:
- using http://localhost:3000 in the app while only https://localhost:3000 is authorized
- using 127.0.0.1 instead of localhost
- copying a Google client ID that belongs to a different OAuth client

The app uses Google Identity Services with an ID-token callback, not a redirect-based OAuth flow, so no Authorized redirect URI is required. No deployed frontend domain is configured in this repository; add the actual production origin only after deployment.
