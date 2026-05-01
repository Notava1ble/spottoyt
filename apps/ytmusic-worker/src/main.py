import json
import os
import sys
import time
from typing import Any

try:
    import ytmusicapi
except ModuleNotFoundError:
    ytmusicapi = None

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

    candidate = {
        "videoId": video_id,
        "title": title,
        "artists": normalize_artists(result.get("artists")),
        "durationMs": int(duration_seconds) * 1000,
        "resultType": result_type,
    }
    album = normalize_album(result.get("album"))

    if album is not None:
        candidate["album"] = album

    return candidate


def match_tracks(
    tracks: list[dict[str, Any]],
    limit: int,
    include_videos: bool = True,
) -> list[dict[str, Any]]:
    started_at = time.perf_counter()
    log_event(
        "ytmusic.worker.command.started",
        trackCount=len(tracks),
        limit=limit,
        includeVideos=include_videos,
    )

    if YTMusic is None:
        raise RuntimeError("Install ytmusicapi before matching.")

    client = YTMusic()
    matches: list[dict[str, Any]] = []

    for track in tracks:
        track_id = track.get("id", "")
        title = track.get("title", "")
        artists = track.get("artists") or []
        primary_artist = artists[0] if artists else ""
        queries = build_search_queries(title, artists, include_videos)
        query_limit = max(1, min(limit, (limit + 1) // 2))
        candidates: list[dict[str, Any]] = []
        seen_video_ids: set[str] = set()

        for query, result_filter in queries:
            log_event(
                "ytmusic.search.started",
                trackId=track_id,
                query=query,
                filter=result_filter,
                limit=query_limit,
            )

            try:
                results = client.search(
                    query,
                    filter=result_filter,
                    limit=query_limit,
                    ignore_spelling=False,
                )
            except Exception as error:
                log_event("ytmusic.search.failed", trackId=track_id, message=str(error))
                break

            before_count = len(candidates)

            for result in results:
                normalized = normalize_result(result)

                if normalized is None or normalized["videoId"] in seen_video_ids:
                    continue

                seen_video_ids.add(normalized["videoId"])
                candidates.append(normalized)

                if len(candidates) >= limit:
                    break

            log_event(
                "ytmusic.search.completed",
                trackId=track_id,
                query=query,
                filter=result_filter,
                rawResults=len(results),
                candidateCount=len(candidates) - before_count,
            )

            if len(candidates) >= limit:
                break

        if not candidates and include_videos:
            fallback_query = " ".join(part for part in [title, primary_artist] if part)
            candidates = search_youtube_videos(fallback_query, primary_artist, limit)
            log_event(
                "ytmusic.youtube_fallback.completed",
                trackId=track_id,
                candidateCount=len(candidates),
            )

        matches.append({"trackId": track_id, "candidates": candidates})

    log_event(
        "ytmusic.worker.command.completed",
        trackCount=len(tracks),
        durationMs=round((time.perf_counter() - started_at) * 1000),
    )

    return matches


def auth_status(auth_path: str) -> dict[str, Any]:
    if not os.path.exists(auth_path):
        return {"provider": "youtubeMusic", "connected": False, "configured": False}

    return validate_auth(auth_path)


def validate_auth(auth_path: str) -> dict[str, Any]:
    if YTMusic is None:
        return {
            "provider": "youtubeMusic",
            "connected": False,
            "configured": True,
            "error": "Install ytmusicapi before authenticating.",
        }

    try:
        client = YTMusic(auth_path)
        account = client.get_account_info()
    except Exception as error:
        log_event("ytmusic.auth.status.failed", message=str(error))
        return {
            "provider": "youtubeMusic",
            "connected": False,
            "configured": True,
            "error": "Reconnect YouTube Music in Settings before creating.",
        }

    status = {"provider": "youtubeMusic", "connected": True, "configured": True}
    display_name = account.get("accountName") or account.get("channelHandle")

    if display_name:
        status["displayName"] = str(display_name)

    return status


def auth_setup(auth_path: str, headers_raw: str) -> dict[str, Any]:
    if ytmusicapi is None:
        raise RuntimeError("Install ytmusicapi before authenticating.")

    parent = os.path.dirname(auth_path)
    if parent:
        os.makedirs(parent, exist_ok=True)

    ytmusicapi.setup(filepath=auth_path, headers_raw=headers_raw)
    return validate_auth(auth_path)


def create_playlist(
    auth_path: str,
    title: str,
    description: str,
    privacy_status: str,
    video_ids: list[str],
) -> dict[str, str]:
    if YTMusic is None:
        raise RuntimeError("Install ytmusicapi before creating playlists.")

    if not os.path.exists(auth_path):
        raise RuntimeError("YouTube Music authentication is not configured.")

    client = YTMusic(auth_path)
    try:
        playlist_id = client.create_playlist(
            title,
            description,
            privacy_status=privacy_status,
            video_ids=video_ids,
        )
    except Exception as error:
        if is_auth_error(error):
            raise RuntimeError(
                "Reconnect YouTube Music in Settings before creating."
            ) from error

        raise

    if not isinstance(playlist_id, str):
        raise RuntimeError("YouTube Music returned an invalid playlist response.")

    return {
        "playlistId": playlist_id,
        "playlistUrl": f"https://music.youtube.com/playlist?list={playlist_id}",
    }


def is_auth_error(error: Exception) -> bool:
    message = str(error).lower()
    return "401" in message or "unauthorized" in message or "sign in" in message


def build_search_queries(
    title: str,
    artists: list[str],
    include_videos: bool,
) -> list[tuple[str, str]]:
    primary_artist = artists[0] if artists else ""
    all_artists = " ".join(artists)
    song_queries = [
        " ".join(part for part in [title, all_artists] if part),
        " ".join(part for part in [title, primary_artist] if part),
        title,
    ]
    video_queries = [
        " ".join(part for part in [title, primary_artist, "official audio"] if part),
        " ".join(part for part in [title, primary_artist, "official video"] if part),
    ]
    queries = [(query, "songs") for query in song_queries]

    if include_videos:
        queries.extend((query, "videos") for query in video_queries)

    deduped_queries: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for query, result_filter in queries:
        compact_query = " ".join(query.split())

        if not compact_query:
            continue

        key = (compact_query, result_filter)
        if key in seen:
            continue

        seen.add(key)
        deduped_queries.append(key)

    return deduped_queries


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
        log_event("ytmusic.youtube_fallback.unavailable", reason="Install yt-dlp.")
        return []

    try:
        with YoutubeDL({"extract_flat": True, "noplaylist": True, "quiet": True}) as youtube:
            results = youtube.extract_info(
                f"ytsearch{limit}:{query}",
                download=False,
            )
    except Exception as error:
        log_event("ytmusic.youtube_fallback.failed", message=str(error))
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
        "durationMs": int(duration) * 1000,
        "resultType": "video",
    }


def log_event(event: str, **fields: Any) -> None:
    print(json.dumps({"event": event, **fields}), file=sys.stderr)


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(
            "Usage: python src/main.py match|auth-status|auth-setup|create-playlist"
        )

    command = sys.argv[1]
    payload = json.load(sys.stdin)

    if command == "match":
        print(
            json.dumps(
                match_tracks(
                    payload.get("tracks", []),
                    int(payload.get("limit", 5)),
                    bool(payload.get("includeVideos", True)),
                )
            )
        )
        return

    if command == "auth-status":
        print(json.dumps(auth_status(str(payload.get("authPath", "")))))
        return

    if command == "auth-setup":
        print(
            json.dumps(
                auth_setup(
                    str(payload.get("authPath", "")),
                    str(payload.get("headersRaw", "")),
                )
            )
        )
        return

    if command == "create-playlist":
        print(
            json.dumps(
                create_playlist(
                    str(payload.get("authPath", "")),
                    str(payload.get("title", "")),
                    str(payload.get("description", "")),
                    str(payload.get("privacyStatus", "PRIVATE")),
                    payload.get("videoIds", []),
                )
            )
        )
        return

    raise SystemExit(
        "Usage: python src/main.py match|auth-status|auth-setup|create-playlist"
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1) from error
