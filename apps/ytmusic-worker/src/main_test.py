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
    @patch("main.YoutubeDL")
    def test_match_tracks_uses_default_search_and_filters_music_results(
        self, youtube_dl, ytmusic
    ):
        client = Mock()
        client.search.return_value = [
            {
                "resultType": "artist",
                "artists": [{"name": "The Temper Trap"}],
            },
            {
                "videoId": "sweet-disposition",
                "title": "Sweet Disposition",
                "artists": [{"name": "The Temper Trap"}],
                "album": {"name": "Conditions"},
                "duration_seconds": 231,
                "resultType": "song",
            },
        ]
        ytmusic.return_value = client
        youtube_dl.assert_not_called()

        response = match_tracks(
            [
                {
                    "id": "spotify:track:sweet-disposition",
                    "title": "Sweet Disposition",
                    "artists": ["The Temper Trap"],
                },
            ],
            limit=5,
        )

        self.assertEqual(
            response,
            [
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
                }
            ],
        )
        client.search.assert_called_once_with(
            "Sweet Disposition The Temper Trap",
            limit=5,
            ignore_spelling=False,
        )

    @patch("main.YTMusic")
    @patch("main.YoutubeDL")
    def test_match_tracks_falls_back_to_youtube_search_when_ytmusic_has_no_candidates(
        self, youtube_dl, ytmusic
    ):
        client = Mock()
        client.search.return_value = [
            {
                "resultType": "artist",
                "artist": "M83",
            }
        ]
        ytmusic.return_value = client
        youtube = Mock()
        youtube.extract_info.return_value = {
            "entries": [
                {
                    "id": "dX3k_QDnzHE",
                    "title": "M83 'Midnight City' Official video",
                    "duration": 244,
                    "channel": "M83",
                }
            ]
        }
        youtube_dl.return_value.__enter__.return_value = youtube

        response = match_tracks(
            [
                {
                    "id": "spotify:track:midnight-city",
                    "title": "Midnight City",
                    "artists": ["M83"],
                }
            ],
            limit=5,
        )

        self.assertEqual(
            response,
            [
                {
                    "trackId": "spotify:track:midnight-city",
                    "candidates": [
                        {
                            "videoId": "dX3k_QDnzHE",
                            "title": "M83 'Midnight City' Official video",
                            "artists": ["M83"],
                            "album": None,
                            "durationMs": 244000,
                            "resultType": "video",
                        }
                    ],
                }
            ],
        )
        youtube.extract_info.assert_called_once_with(
            "ytsearch5:Midnight City M83",
            download=False,
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
            "Sweet Disposition The Temper Trap",
            limit=5,
            ignore_spelling=False,
        )

    @patch("main.YTMusic")
    def test_match_tracks_emits_structured_diagnostics(self, ytmusic):
        client = Mock()
        client.search.return_value = []
        ytmusic.return_value = client

        with patch("main.log_event") as log_event:
            match_tracks(
                [
                    {
                        "id": "spotify:track:midnight-city",
                        "title": "Midnight City",
                        "artists": ["M83"],
                    }
                ],
                limit=5,
            )

        event_names = [call.args[0] for call in log_event.call_args_list]
        self.assertIn("ytmusic.worker.command.started", event_names)
        self.assertIn("ytmusic.search.started", event_names)
        self.assertIn("ytmusic.search.completed", event_names)
        self.assertIn("ytmusic.worker.command.completed", event_names)

    @patch("main.YTMusic", None)
    def test_match_tracks_reports_missing_ytmusicapi(self):
        with self.assertRaisesRegex(RuntimeError, "Install ytmusicapi"):
            match_tracks([], limit=5)


if __name__ == "__main__":
    unittest.main()
