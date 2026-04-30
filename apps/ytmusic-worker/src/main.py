import json
import sys
from typing import Any

try:
    from ytmusicapi import YTMusic
except ModuleNotFoundError:
    YTMusic = None


def normalize_result(result: dict[str, Any]) -> dict[str, Any] | None:
    video_id = result.get("videoId")
    title = result.get("title")
    duration_seconds = result.get("duration_seconds")

    if not video_id or not title or not duration_seconds:
        return None

    return {
        "videoId": video_id,
        "title": title,
        "artists": normalize_artists(result.get("artists")),
        "album": normalize_album(result.get("album")),
        "durationMs": int(duration_seconds) * 1000,
        "resultType": result.get("resultType", "song"),
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

        try:
            results = client.search(
                f'"{title}" "{primary_artist}"',
                filter="songs",
                limit=limit,
                ignore_spelling=True,
            )
            candidates = [
                normalized
                for normalized in (normalize_result(result) for result in results)
                if normalized is not None
            ]
        except Exception:
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
