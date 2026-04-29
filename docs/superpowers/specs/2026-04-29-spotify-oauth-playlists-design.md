# Spotify OAuth Playlists Design

## Goal

Let a local SpottoYT user connect their own Spotify developer app credentials through `.env`, complete Spotify OAuth in the local Fastify API, and browse their Spotify playlists in the Convert flow.

## Decisions

- Spotify credentials stay server-side in `.env` as `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `SPOTIFY_REDIRECT_URI`.
- The React app never receives the client secret. It only calls the local API.
- The backend owns the Authorization Code flow, token exchange, token refresh, and Spotify Web API requests.
- The first implementation stores tokens in memory. This is enough to test login and playlist listing locally without committing persistence choices before the database layer exists.
- If Spotify rejects requests because the developer app owner lacks Premium or is not allowed in development mode, the API returns a clear disconnected/error state instead of hiding the failure.

## API Shape

- `GET /auth/status` reports whether Spotify credentials are configured and whether a Spotify token is currently available.
- `GET /auth/spotify/login` redirects the browser to Spotify with `playlist-read-private`, `playlist-read-collaborative`, and `user-read-private` scopes.
- `GET /auth/spotify/callback` validates the OAuth `state`, exchanges the authorization code, stores the token server-side, and redirects to the web Convert page.
- `POST /auth/spotify/logout` clears the in-memory Spotify token.
- `GET /spotify/playlists` returns normalized playlist summaries for the connected user.

## UI Shape

Settings shows whether Spotify config is present and displays the callback URI users must register in Spotify. Convert shows a Spotify account card with a Connect action when disconnected, and a playlist picker when connected. The existing playlist URL import remains as a fallback.

## Verification

Backend tests cover credential status, login redirect validation, callback error handling, token-backed playlist listing, and logout. Web tests cover the Settings/Convert connected and disconnected states using mocked fetch responses.
