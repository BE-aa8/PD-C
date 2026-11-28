# Embed the YouTube video and add its verbatim transcript (Claude)

## Context
Andrew has published the presentation video (https://www.youtube.com/watch?v=SKINf0_tK18). He pasted its YouTube
auto-generated transcript and wants both on the Video & Transcript tab. This is assignment requirements 2 and 3, the last
placeholders on the site. Recorded date: 2026-11-28 (his answer).

## How the paste becomes the transcript (verbatim)
YouTube's copy glues a spoken-duration label onto each timestamp. For example, `0:011 secondHey guys` is really
`0:01` + "1 second" (the screen-reader label) + `Hey guys`, and `1:011 minute, 1 second` follows the same pattern.

- A small script splits the paste into segments of the form `[timestamp, text]`. It removes only the duplicated
  duration label, which is checked against the timestamp so nothing else can be cut.
- The spoken words are kept **exactly as YouTube produced them**, recognition errors included ("clawed code",
  "quad opus", "talc", "gluccogen"). This is required by the assignment and by CLAUDE.md ("never fabricate
  transcripts").
- A one-line note above the transcript explains that it is auto-generated and that misheard words such as "clawed code"
  mean Claude Code. No words are changed.
- The script also checks that the word count of the segments equals the word count of the paste minus the labels.

## Changes
1. **`site/js/video.js`**:
   - `youtubeId: 'SKINf0_tK18'` and `recordedOn: '2026-11-28'`.
   - `transcript`: one line per segment, `m:ss text`. It goes inside a template literal, so check it for backticks and
     `${`.
2. **`site/js/app.js`, `buildVideo()`**:
   - Keep the existing click-to-load poster, so YouTube loads only when the viewer clicks.
   - Transcript rendering: a line that starts with a timestamp becomes a row with a timestamp button and its text.
     Clicking the button loads or reloads the player at `?start=<seconds>&autoplay=1` and scrolls the video into view.
   - Add the auto-generated note.
   - Keep the fallback: plain paragraphs if a line has no timestamp.
   - Add a "Watch on YouTube" link in the video meta box.
3. **`site/index.html`**: the "Recorded" fallback text stays; JS sets the date.
4. **`site/css/style.css`**: transcript rows laid out as a grid (timestamp column, then text), styled like the existing
   `.transcript-body`, and readable in light and dark themes.
5. **`tests/browser-content.mjs`**:
   - Update the video check: the poster shows the right thumbnail URL, and no iframe loads before the click.
   - Transcript check: segment count > 100; the first and last lines match `video.js`.
   - Clicking a timestamp creates an iframe whose src contains `start=` (YouTube requests are stubbed, as in the smoke
     test).
6. **Docs**:
   - `docs/PROJECT_STATUS.md`: mark the video and transcript rows done.
   - Add Part 27 to `docs/process-log.md` (prompt 45).
   - Save this plan as `docs/plan-video-transcript-claude.md`.
   - Commit to `claude/site-build`, fast-forward `main`, push, and watch CI including the live-site tests.

No changes to `model.js`, `data.js`, or `site/gemini/**`.

## Verification
- Parsing script: the segment count, first segment `0:01 "Hey guys, it's Andrew uh back again…"`, last segment
  `23:20 "Thanks for watching."`, and the word-count check.
- `npm test`, plus the local content, a11y (including slow fonts) and smoke wrappers against
  `python3 -m http.server 8768`.
- Screenshot the Video tab with the poster and the open transcript, desktop and phone, light and dark. Click a
  timestamp and confirm the iframe src has the right `start`.
- CI green, including the live-site tests.
