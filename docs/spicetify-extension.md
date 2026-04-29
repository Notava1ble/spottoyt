# Spicetify Extension Import

SpottoYT now treats Spotify Web API OAuth as deprecated. The primary local import
path is a Spicetify extension that runs inside Spotify desktop, reads the open
playlist through the desktop session, and posts normalized track metadata to the
local API.

## Workflow

1. Start SpottoYT with `bun run dev`.
2. Open Spotify desktop with Spicetify applied.
3. Open a Spotify playlist.
4. Press `Send to SpottoYT` in the Spotify top bar.
5. The extension posts the playlist snapshot to
   `http://127.0.0.1:4317/imports/spicetify`.
6. The web app listens to `http://127.0.0.1:4317/events` and moves to review
   when the import arrives.

The extension sends playlist metadata only: playlist URI/name, snapshot time,
track URI/title/artists/album/duration/ISRC/explicit flag/position. It does not
send Spotify credentials.

## Local Install

Build the extension:

```bash
bun run build:spicetify
```

Copy `apps/spicetify-extension/dist/spottoyt.js` into the Spicetify extensions
folder:

```powershell
Copy-Item apps\spicetify-extension\dist\spottoyt.js $env:APPDATA\spicetify\Extensions\spottoyt.js
spicetify config extensions spottoyt.js
spicetify apply
```

If the local API port changes, set the extension target in Spotify DevTools:

```js
Spicetify.LocalStorage.set("spottoyt-api-url", "http://127.0.0.1:4317")
```

## Notes

Spicetify relies on Spotify desktop internals. Keep this extension small and
replaceable. SpottoYT should continue to own matching, review, persistence, and
YouTube Music writes.
