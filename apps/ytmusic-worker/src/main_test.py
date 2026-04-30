import unittest
from unittest.mock import Mock, patch

from main import match_tracks, normalize_result


class YtmusicWorkerTest(unittest.TestCase):
    def test_normalize_result_maps_song_fields(self):
        result = normalize_result(
            {
                "videoId": "abc123",
                "title": "Midnight City",
                "artists": [{"name": "M83"}],
                "album": {"name": "Hurry Up, We're Dreaming"},
                "duration_seconds": 243,
                "resultType": "song",
            }
        )

        self.assertEqual(
            result,
            {
                "videoId": "abc123",
                "title": "Midnight City",
                "artists": ["M83"],
                "album": "Hurry Up, We're Dreaming",
                "durationMs": 243000,
                "resultType": "song",
            },
        )

    @patch("main.YTMusic")
    def test_match_tracks_continues_when_one_track_search_fails(self, ytmusic):
        client = Mock()
        client.search.side_effect = [
            RuntimeError("temporary search failure"),
            [
                {
                    "videoId": "sweet-disposition",
                    "title": "Sweet Disposition",
                    "artists": [{"name": "The Temper Trap"}],
                    "album": {"name": "Conditions"},
                    "duration_seconds": 231,
                    "resultType": "song",
                }
            ],
        ]
        ytmusic.return_value = client

        response = match_tracks(
            [
                {
                    "id": "spotify:track:broken",
                    "title": "Broken",
                    "artists": ["Artist"],
                },
                {
                    "id": "spotify:track:sweet-disposition",
                    "title": "Sweet Disposition",
                    "artists": ["The Temper Trap"],
                },
            ],
            limit=5,
        )

        self.assertEqual(response[0], {"trackId": "spotify:track:broken", "candidates": []})
        self.assertEqual(
            response[1],
            {
                "trackId": "spotify:track:sweet-disposition",
                "candidates": [
                    {
                        "videoId": "sweet-disposition",
                        "title": "Sweet Disposition",
                        "artists": ["The Temper Trap"],
                        "album": "Conditions",
                        "durationMs": 231000,
                        "resultType": "song",
                    }
                ],
            },
        )
        client.search.assert_any_call(
            '"Sweet Disposition" "The Temper Trap"',
            filter="songs",
            limit=5,
            ignore_spelling=True,
        )

    @patch("main.YTMusic", None)
    def test_match_tracks_reports_missing_ytmusicapi(self):
        with self.assertRaisesRegex(RuntimeError, "Install ytmusicapi"):
            match_tracks([], limit=5)


if __name__ == "__main__":
    unittest.main()
