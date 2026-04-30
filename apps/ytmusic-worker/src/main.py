import json
import sys
from typing import Any

try:
    from ytmusicapi import YTMusic
except ModuleNotFoundError:
    YTMusic = None

try:
    from yt_dlp import YoutubeDL
except ModuleNotFoundError:
    YoutubeDL = None


def normalize_result(result: dict[str, Any]) -> dict[str, Any] | None:
    video_id = result.get("videoId")
    title = result.get("title")
    duration_seconds = result.get("duration_seconds")
    result_type = result.get("resultType", "song")

    if result_type not in {"song", "video"}:
        return None

    if not video_id or not title or not duration_seconds:
        return None

    return {
        "videoId": video_id,
        "title": title,
        "artists": normalize_artists(result.get("artists")),
        "album": normalize_album(result.get("album")),
        "durationMs": int(duration_seconds) * 1000,
        "resultType": result_type,
    }


def match_tracks(tracks: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    if YTMusic is None:
        raise RuntimeError("Install ytmusicapi before matching.")

    client = YTMusic()
    matches: list[dict[str, Any]] = []

    for track in tracks:
        track_id = track.get("id", "")
        title = track.get("title", "")
        artists = track.get("artists") or []
        primary_artist = artists[0] if artists else ""
        query = " ".join(part for part in [title, primary_artist] if part)

        log_event("search-start", trackId=track_id, query=query, limit=limit)

        try:
            results = client.search(
                query,
                limit=limit,
                ignore_spelling=False,
            )
            candidates = [
                normalized
                for normalized in (normalize_result(result) for result in results)
                if normalized is not None
            ]
            log_event(
                "search-complete",
                trackId=track_id,
                rawResults=len(results),
                candidates=len(candidates),
            )
            if not candidates:
                candidates = search_youtube_videos(query, primary_artist, limit)
                log_event(
                    "youtube-fallback-complete",
                    trackId=track_id,
                    candidates=len(candidates),
                )
        except Exception as error:
            log_event("search-error", trackId=track_id, message=str(error))
            candidates = []

        matches.append({"trackId": track_id, "candidates": candidates})

    return matches


def normalize_artists(artists: Any) -> list[str]:
    if not isinstance(artists, list):
        return []

    names: list[str] = []
    for artist in artists:
        if isinstance(artist, dict) and isinstance(artist.get("name"), str):
            names.append(artist["name"])
        elif isinstance(artist, str):
            names.append(artist)

    return names


def normalize_album(album: Any) -> str | None:
    if isinstance(album, dict) and isinstance(album.get("name"), str):
        return album["name"]

    if isinstance(album, str):
        return album

    return None


def search_youtube_videos(
    query: str,
    primary_artist: str,
    limit: int,
) -> list[dict[str, Any]]:
    if YoutubeDL is None:
        log_event("youtube-fallback-unavailable", reason="Install yt-dlp.")
        return []

    try:
        with YoutubeDL({"extract_flat": True, "noplaylist": True, "quiet": True}) as youtube:
            results = youtube.extract_info(
                f"ytsearch{limit}:{query}",
                download=False,
            )
    except Exception as error:
        log_event("youtube-fallback-error", message=str(error))
        return []

    candidates: list[dict[str, Any]] = []
    for entry in results.get("entries", []) if isinstance(results, dict) else []:
        candidate = normalize_youtube_video(entry, primary_artist)
        if candidate is not None:
            candidates.append(candidate)

    return candidates


def normalize_youtube_video(
    entry: dict[str, Any],
    primary_artist: str,
) -> dict[str, Any] | None:
    video_id = entry.get("id")
    title = entry.get("title")
    duration = entry.get("duration")

    if not video_id or not title or not duration:
        return None

    return {
        "videoId": video_id,
        "title": title,
        "artists": [primary_artist] if primary_artist else [entry.get("channel", "YouTube")],
        "album": None,
        "durationMs": int(duration) * 1000,
        "resultType": "video",
    }


def log_event(event: str, **fields: Any) -> None:
    print(json.dumps({"event": event, **fields}), file=sys.stderr)


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] != "match":
        raise SystemExit("Usage: python src/main.py match")

    payload = json.load(sys.stdin)
    matches = match_tracks(payload.get("tracks", []), int(payload.get("limit", 5)))
    print(json.dumps(matches))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from error
