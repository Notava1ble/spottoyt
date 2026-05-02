import unittest
from unittest.mock import Mock, patch

from main import (
    add_playlist_items,
    auth_setup,
    auth_status,
    build_search_queries,
    create_playlist,
    match_tracks,
    normalize_result,
)


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

    def test_normalize_result_omits_missing_album(self):
        result = normalize_result(
            {
                "videoId": "abc123",
                "title": "Midnight City",
                "artists": [{"name": "M83"}],
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
        client.search.assert_any_call(
            "Sweet Disposition The Temper Trap",
            filter="songs",
            limit=3,
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
    @patch("main.YoutubeDL")
    def test_match_tracks_uses_targeted_song_and_video_queries_with_deduplication(
        self, youtube_dl, ytmusic
    ):
        client = Mock()
        calls = []

        def search(query, **kwargs):
            calls.append((query, kwargs))

            if kwargs.get("filter") == "songs" and query == "Love Me Lil Wayne Drake Future":
                return [
                    {
                        "videoId": "love-me-song",
                        "title": "Love Me",
                        "artists": [{"name": "Lil Wayne"}, {"name": "Drake"}, {"name": "Future"}],
                        "duration_seconds": 257,
                        "resultType": "song",
                    }
                ]

            if kwargs.get("filter") == "videos":
                return [
                    {
                        "videoId": "love-me-song",
                        "title": "Lil Wayne - Love Me (Lyrics) ft. Drake, Future",
                        "artists": [{"name": "Lil Wayne"}],
                        "duration_seconds": 257,
                        "resultType": "video",
                    },
                    {
                        "videoId": "love-me-video",
                        "title": "Lil Wayne - Love Me (Official Music Video) ft. Drake, Future",
                        "artists": [{"name": "Lil Wayne"}],
                        "duration_seconds": 259,
                        "resultType": "video",
                    },
                ]

            return []

        client.search.side_effect = search
        ytmusic.return_value = client

        response = match_tracks(
            [
                {
                    "id": "spotify:track:love-me",
                    "title": "Love Me",
                    "artists": ["Lil Wayne", "Drake", "Future"],
                }
            ],
            limit=8,
            include_videos=True,
        )

        self.assertEqual(
            [candidate["videoId"] for candidate in response[0]["candidates"]],
            ["love-me-song", "love-me-video"],
        )
        self.assertIn(
            (
                "Love Me Lil Wayne Drake Future",
                {"filter": "songs", "limit": 4, "ignore_spelling": False},
            ),
            calls,
        )
        self.assertTrue(any(call[1].get("filter") == "videos" for call in calls))
        youtube_dl.assert_not_called()

    @patch("main.YTMusic")
    @patch("main.YoutubeDL")
    def test_match_tracks_keeps_video_candidates_when_song_results_fill_limit(
        self, youtube_dl, ytmusic
    ):
        client = Mock()

        def search(_query, **kwargs):
            if kwargs.get("filter") == "songs":
                return [
                    {
                        "videoId": f"random-song-{index}",
                        "title": f"Random Song {index}",
                        "artists": [{"name": "Other Artist"}],
                        "duration_seconds": 180 + index,
                        "resultType": "song",
                    }
                    for index in range(6)
                ]

            return [
                {
                    "videoId": "the-loneliest-video",
                    "title": "Måneskin - THE LONELIEST (Official Video)",
                    "artists": [{"name": "Måneskin"}],
                    "duration_seconds": 247,
                    "resultType": "video",
                }
            ]

        client.search.side_effect = search
        ytmusic.return_value = client

        response = match_tracks(
            [
                {
                    "id": "spotify:track:the-loneliest",
                    "title": "THE LONELIEST",
                    "artists": ["Måneskin"],
                }
            ],
            limit=3,
            include_videos=True,
        )

        self.assertIn(
            "the-loneliest-video",
            [candidate["videoId"] for candidate in response[0]["candidates"]],
        )

    def test_build_search_queries_uses_official_video_queries_without_lyrics(self):
        queries = build_search_queries(
            "Love Me",
            ["Lil Wayne", "Drake", "Future"],
            True,
        )

        self.assertIn(("Love Me Lil Wayne official audio", "videos"), queries)
        self.assertIn(("Love Me Lil Wayne official video", "videos"), queries)
        self.assertNotIn(("Love Me Lil Wayne lyrics", "videos"), queries)
        self.assertLess(
            queries.index(("Love Me Lil Wayne", "songs")),
            queries.index(("Love Me Lil Wayne official audio", "videos")),
        )

    def test_build_search_queries_includes_diacritic_folded_variants(self):
        queries = build_search_queries(
            "THE LONELIEST",
            ["Måneskin"],
            True,
        )

        self.assertIn(("THE LONELIEST Måneskin", "songs"), queries)
        self.assertIn(("THE LONELIEST Maneskin", "songs"), queries)
        self.assertIn(
            ("THE LONELIEST Maneskin official video", "videos"),
            queries,
        )

    @patch("main.YTMusic")
    @patch("main.YoutubeDL")
    def test_match_tracks_skips_video_queries_when_videos_are_disabled(
        self, youtube_dl, ytmusic
    ):
        client = Mock()
        calls = []

        def search(query, **kwargs):
            calls.append((query, kwargs))
            return []

        client.search.side_effect = search
        ytmusic.return_value = client

        response = match_tracks(
            [
                {
                    "id": "spotify:track:midnight-city",
                    "title": "Midnight City",
                    "artists": ["M83"],
                }
            ],
            limit=8,
            include_videos=False,
        )

        self.assertEqual(response[0], {"trackId": "spotify:track:midnight-city", "candidates": []})
        self.assertFalse(any(call[1].get("filter") == "videos" for call in calls))
        youtube_dl.assert_not_called()

    @patch("main.YTMusic")
    @patch("main.YoutubeDL")
    def test_match_tracks_continues_when_one_track_search_fails(self, youtube_dl, ytmusic):
        youtube_dl.return_value.__enter__.return_value.extract_info.return_value = {
            "entries": []
        }
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
            filter="songs",
            limit=3,
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

    @patch("main.ytmusicapi")
    @patch("main.YTMusic")
    def test_auth_setup_writes_browser_headers_and_validates_account(
        self, ytmusic, ytmusicapi
    ):
        ytmusicapi.setup.return_value = "{}"
        client = Mock()
        client.get_account_info.return_value = {"accountName": "Visar"}
        ytmusic.return_value = client

        result = auth_setup("auth/browser.json", "accept: */*\ncookie: secret")

        self.assertEqual(
            result,
            {
                "provider": "youtubeMusic",
                "connected": True,
                "configured": True,
                "displayName": "Visar",
            },
        )
        ytmusicapi.setup.assert_called_once_with(
            filepath="auth/browser.json",
            headers_raw="accept: */*\ncookie: secret",
        )
        ytmusic.assert_called_once_with("auth/browser.json")
        client.get_account_info.assert_called_once_with()

    @patch("main.YTMusic")
    @patch("main.os.path.exists")
    def test_auth_status_reports_valid_auth_file(self, exists, ytmusic):
        exists.return_value = True
        client = Mock()
        client.get_account_info.return_value = {"accountName": "Visar"}
        ytmusic.return_value = client

        result = auth_status("auth/browser.json")

        self.assertEqual(
            result,
            {
                "provider": "youtubeMusic",
                "connected": True,
                "configured": True,
                "displayName": "Visar",
            },
        )
        ytmusic.assert_called_once_with("auth/browser.json")
        client.get_account_info.assert_called_once_with()

    @patch("main.os.path.exists")
    def test_auth_status_reports_missing_auth_file(self, exists):
        exists.return_value = False

        result = auth_status("auth/browser.json")

        self.assertEqual(result, {"provider": "youtubeMusic", "connected": False, "configured": False})

    @patch("main.YTMusic")
    @patch("main.os.path.exists")
    def test_create_playlist_creates_private_playlist_with_selected_items(self, exists, ytmusic):
        exists.return_value = True
        client = Mock()
        client.create_playlist.return_value = "PL123"
        ytmusic.return_value = client

        result = create_playlist(
            "auth/browser.json",
            "Road trip - YouTube Music",
            "Converted from Spotify by SpottoYT.",
            "PRIVATE",
            ["song-1", "song-2"],
        )

        self.assertEqual(
            result,
            {
                "playlistId": "PL123",
                "playlistUrl": "https://music.youtube.com/playlist?list=PL123",
            },
        )
        client.create_playlist.assert_called_once_with(
            "Road trip - YouTube Music",
            "Converted from Spotify by SpottoYT.",
            privacy_status="PRIVATE",
            video_ids=["song-1", "song-2"],
        )
        client.add_playlist_items.assert_not_called()

    @patch("main.YTMusic")
    @patch("main.os.path.exists")
    def test_add_playlist_items_updates_existing_playlist(self, exists, ytmusic):
        exists.return_value = True
        client = Mock()
        ytmusic.return_value = client

        result = add_playlist_items(
            "auth/browser.json",
            "PL123",
            ["song-3"],
        )

        self.assertEqual(
            result,
            {
                "playlistId": "PL123",
                "playlistUrl": "https://music.youtube.com/playlist?list=PL123",
            },
        )
        client.add_playlist_items.assert_called_once_with("PL123", ["song-3"])


if __name__ == "__main__":
    unittest.main()
