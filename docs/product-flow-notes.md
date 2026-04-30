# Product Flow Notes

These notes capture the current product direction for future agent sessions. They are intentionally loose. Treat them as a working model to evolve, not as a frozen implementation spec.

## Navigation Shape

The app is expected to feel like a focused local tool rather than a multi-section dashboard. A sidebar is probably not the right long-term fit because the conversion screens are sequential stages, not independent destinations.

The preferred top-level navigation is:

- Convert
- Library
- Settings

## Convert

Convert is the main workspace for starting a new Spotify to YouTube Music conversion.

The page should first check whether Spotify desktop bridge input and YouTube Music access are ready. If one is missing, show a setup gate or compact account prompts.

Playlist selection should primarily support:

- pushing the currently open Spotify desktop playlist through the Spicetify extension
- later, importing Spotify export files or CSV/TSV snapshots

After a playlist is chosen, the flow can move linearly through a small number of stages such as selecting/importing, reviewing matches, confirming, creating, and completion. The user does not need free navigation between all stages. If they want to change the source playlist or restart the process, a reset action is enough.

## Review And Create

Review is the main value surface. It should help the user quickly accept, replace, or skip YouTube Music matches for Spotify tracks.

The create step should only write reviewed decisions to YouTube Music. It should avoid converting tracks that already have a stored local decision saying they were converted or skipped.

## Library

Library is for converted playlists and future maintenance. The app should store local conversion data after a playlist is converted, including enough information to understand each track's state later.

Useful local state may include:

- Spotify track identity and metadata
- selected YouTube Music track identity and metadata
- status such as pending, converted, skipped, failed, or removed
- timestamps or source snapshots when they become useful

When a converted playlist is refreshed from Spotify, the app should compare the new Spotify source state with the stored local snapshot. Previously converted tracks should not be converted again. Previously skipped tracks should stay skipped. New or undecided tracks can enter the review/create flow.

The rough goal is incremental updates: if the original Spotify playlist changes, SpottoYT should process only the changed or new tracks instead of forcing a full reconversion.

## YouTube Sync

Refreshing from YouTube Music is useful but secondary. The default workflow can rely on the local snapshot and Spicetify-pushed Spotify refreshes first.

Later, an explicit sync action in Library may compare the stored YouTube playlist state with the real YouTube Music playlist. This could let the app notice that a user manually removed a converted song on YouTube and update the local state so the song can be re-imported if desired.

Do not make this a required part of the normal conversion path until the rest of the flow needs it.

## Settings

Settings owns authentication and local configuration. This includes Spicetify extension endpoints, YouTube Music auth/configuration, local database paths, and future matching or sync preferences.
