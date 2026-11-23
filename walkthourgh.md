# Guess The Album: Project Walkthrough

This guide explains how the app starts, where its state lives, how it talks to Deezer, and how the main game interactions fit together. It is intended as a map for reading and changing the code, not just as a list of files.

## 1. What the app does

Guess The Album is a React single-page game. It loads a Deezer album chart for the selected genre, chooses one album at random, and asks the player to identify it from a blurred cover.

The player gets six guesses. The cover becomes clearer as guesses are used; a correct answer or the sixth guess ends the round and reveals the cover and answer. Up to three hints can be shown, in order:

1. Release year
2. Album genre
3. Album artist(s)

The title autocomplete is a helper, not a requirement: a player can submit any typed title even if autocomplete has no result or fails.

## 2. Project map

```text
index.html
└── src/main.tsx                 React entry point and StrictMode
    └── src/App.tsx              Page composition and chart/genre loading
        ├── components/AlbumArtwork.tsx
        └── components/GamePanel.tsx
            ├── components/AlbumGuessForm.tsx
            ├── components/AlbumHints.tsx
            └── components/GuessHistory.tsx

src/services/deezer.ts           Deezer types, requests, JSONP adapter
src/store/game.ts                Zustand game state and rules
src/constants/game.ts            Shared limits and autocomplete settings
src/index.css                    Global theme tokens and base styles
src/App.css                      Page and component layout styles
```

The main separation is:

- **Page orchestration:** [App.tsx](./src/App.tsx) loads charts and genres and passes state to the UI.
- **Game rules:** [game.ts](./src/store/game.ts) owns guesses, answer comparison, hints used, and round status.
- **External data:** [deezer.ts](./src/services/deezer.ts) owns Deezer request details and response validation.
- **Presentation and interaction:** `components/` contains smaller UI pieces.
- **Shared settings:** [game.ts](./src/constants/game.ts) keeps limits in one place.

## 3. Startup and first round

### Entry point

[index.html](./index.html) contains the root `<div>` and page metadata. Vite loads [src/main.tsx](./src/main.tsx), which creates the React root and renders `App` inside React `StrictMode`.

Strict Mode intentionally runs effect setup and cleanup an extra time during development. For that reason, network effects use `AbortController` and guard against stale completions. The JSONP adapter also has to handle a response arriving after cancellation.

### App initialization

[App.tsx](./src/App.tsx) starts with Global selected (`selectedGenreId = 0`) and two independent effects:

1. **Chart effect:** calls `fetchChartAlbums(selectedGenreId)`. It chooses one album at random from the returned array, then calls the Zustand `startRound` action.
2. **Genre effect:** calls `fetchGenres()` once to populate the genre selector. The UI adds Global itself, so the service filters Deezer's genre ID `0` from the returned options.

Each effect creates an `AbortController`. Its cleanup marks that effect instance inactive and aborts its request. The `isActive` check prevents a stale response from updating the page after the selection or component has changed.

If genre loading fails, Global remains available. If chart loading fails, the error is shown in `GamePanel` with a retry action.

## 4. A round from start to finish

### State model

[game.ts](./src/store/game.ts) defines the Zustand `GameState`:

| State | Meaning |
| --- | --- |
| `currentAlbum` | The answer album, or `null` while no round is loaded |
| `guesses` | Submitted guess strings, in order |
| `status` | `playing`, `won`, or `lost` |
| `hintsRevealed` | Number of hints already requested, from zero to three |
| `roundsPlayed` | Counter used to reset component-local state between rounds |

Components read the store through `useGameStore`. `App` subscribes to the data needed for page composition; `GamePanel`, `AlbumGuessForm`, and `AlbumHints` use store actions where they handle user actions.

### Guess submission

`AlbumGuessForm` handles the form and passes the typed string to `submitGuess`. The store ignores empty guesses and guesses submitted without an active, playing round.

Answer matching is normalized in the store:

1. Unicode text is decomposed with `normalize('NFD')`.
2. Combining accent marks are removed.
3. Text is lowercased.
4. Everything except ASCII letters and digits is removed.

This makes differences in capitalization, accents, spaces, and punctuation irrelevant. A guess is otherwise compared as a complete title; this is not fuzzy matching.

The store appends the trimmed guess. A match sets `status` to `won`; otherwise, reaching `MAX_TRIES` sets it to `lost`. Until either condition occurs, status stays `playing`.

[GuessHistory.tsx](./src/components/GuessHistory.tsx) displays the submitted strings, marks the matching answer, and renders a six-segment attempt meter. It repeats the same normalization logic to determine which row is correct.

### Cover reveal

[App.tsx](./src/App.tsx) computes the blur from the number of submitted guesses:

```text
blur = max(0, ((MAX_TRIES - guessesUsed) / MAX_TRIES) * 18)
```

With zero guesses the blur is 18px; each attempt reduces it, and at six guesses it reaches zero. [AlbumArtwork.tsx](./src/components/AlbumArtwork.tsx) also removes the blur as soon as status is `won` or `lost`, so the cover and answer are fully revealed at round end.

The artwork uses Deezer's `cover_xl`, falling back to `cover_big`. A small image scale avoids showing empty edges when the blurred image is clipped.

### Starting another round

- **Play next round:** `GamePanel` calls `App`'s `nextRound`, which resets the store and starts a fresh chart request.
- **Chart retry:** when chart loading fails, the retry action clears the page error and increments `chartRequestId`, which retriggers the chart effect.
- **Genre selection:** selecting a different genre resets the active round and requests a new chart for that genre.

`startRound` increments `roundsPlayed`. `GamePanel` uses that value as a React `key` for the guess form and hints component, which resets their local input/error/retry state when a new round starts.

## 5. Deezer service and browser requests

[deezer.ts](./src/services/deezer.ts) is the only module that knows how requests are made. It exports the shared Deezer data types and four operations:

| Function | Deezer endpoint | Purpose |
| --- | --- | --- |
| `fetchChartAlbums(genreId)` | `/chart/{genreId}/albums?limit=100` | Loads a chart, validates its list, rejects an empty chart, and returns at most 100 albums |
| `fetchGenres()` | `/genre` | Loads genres and removes the Global entry (ID `0`) |
| `searchAlbumSuggestions(query)` | `/search/album?q=...&limit=6` | Supplies title autocomplete |
| `fetchAlbumDetails(albumId)` | `/album/{albumId}` | Loads release date, genre, and album-level artist detail for hints |

The module uses Axios and a custom JSONP adapter. A normal browser request to the Deezer API is subject to cross-origin restrictions; JSONP lets the browser load Deezer's response as a script instead.

### JSONP adapter lifecycle

For each request, the adapter:

1. Copies Axios query parameters into a URL and adds `output=jsonp` plus a unique callback name.
2. Registers that callback on `window`.
3. Adds a script element pointing at Deezer.
4. Resolves the Axios response when Deezer calls the callback; rejects on script error, cancellation, or a 15-second timeout.
5. Removes the script, timer, and callback when the request is finished.

`settle` makes completion idempotent, so competing events cannot resolve or reject the same request twice. On cancellation it removes the script and rejects promptly, but leaves the callback available until a late response arrives or the timeout fires. This prevents a late JSONP script from calling a callback that was already deleted, which would otherwise cause an uncaught browser error.

`requestDeezer` centralizes Axios setup and Deezer API error handling. `requestDeezerList` adds validation for endpoints whose payload contains a `data` array. The public functions then apply endpoint-specific behavior and error messages. These requests are not cached; each chart, hint-detail, or autocomplete request is transient.

## 6. Component responsibilities

### [AlbumArtwork.tsx](./src/components/AlbumArtwork.tsx)

Displays the round's cover, status, remaining-guess count, and final answer stamp. Its parent provides the cover URL, title, blur amount, loading state, and game status. It does not fetch data or update game state.

### [GamePanel.tsx](./src/components/GamePanel.tsx)

Composes the guessing panel. It chooses between:

- A chart error and retry action
- The guess form plus hints while the round is active
- A next-round button once the player wins or loses

It also includes `GuessHistory` whenever an answer album exists.

### [AlbumGuessForm.tsx](./src/components/AlbumGuessForm.tsx)

Owns the temporary input value, autocomplete visibility, highlighted suggestion, and suggestion-request result. It handles keyboard controls, submission, and suggestion selection. Selecting an option fills the input; the player still submits it as a guess.

Autocomplete waits for `AUTOCOMPLETE_DEBOUNCE_MS` after typing, requires at least `AUTOCOMPLETE_MIN_LENGTH` characters, and shows up to `AUTOCOMPLETE_LIMIT` results. Each request is cancellable. The result is associated with its query so stale suggestions are not displayed for newer text.

### [AlbumHints.tsx](./src/components/AlbumHints.tsx)

Displays hints and owns the transient album-details request state. The first revealed hint triggers `fetchAlbumDetails`; subsequent hints use the same loaded details. It shows release year first, genre second, and album artists third. Artist names are deduplicated and come from the album detail's artist/contributors, with the chart album's artist as a fallback. Failed details can be retried.

### [GuessHistory.tsx](./src/components/GuessHistory.tsx)

Renders the submitted guesses, correct/incorrect indicators, count, and attempt meter. It is presentation-only; the source of guesses remains the Zustand store.

## 7. Styling and responsive layout

[index.css](./src/index.css) defines the dark color palette, typography variables, focus styles, and global element defaults. [App.css](./src/App.css) styles the page shell, header, intro, genre picker, artwork, game panel, autocomplete, hints, history, and footer.

The main game layout places artwork and controls side by side on wider screens. At `820px` and below it becomes a single column; at `480px` and below the shell, typography, and panel spacing become more compact.

Components use semantic regions, labels, live statuses, and button/input states for accessibility. Focus-visible outlines use the shared accent color.

## 8. Shared constants

[game.ts](./src/constants/game.ts) is the source of the game and autocomplete limits:

- `MAX_TRIES`: six attempts
- `MAX_HINTS`: three hints
- `ALBUMS_PER_CHART`: 100 albums requested from a chart
- `AUTOCOMPLETE_MIN_LENGTH`: two characters
- `AUTOCOMPLETE_DEBOUNCE_MS`: 250ms
- `AUTOCOMPLETE_LIMIT`: six suggestions

Use these constants instead of duplicating limits in components or services, so UI counts and request behavior stay aligned.

## 9. Development commands

Run these from the project root:

```sh
npm install
npm run dev
npm run build
npm run lint
npm run test
```

- `npm run dev` starts the Vite development server with hot module replacement.
- `npm run build` runs TypeScript project checks and creates a production build in `dist/`.
- `npm run lint` runs ESLint.
- `npm run test` invokes Vitest. No test files were present under `src/` when this walkthrough was written.

## 10. Suggested reading order

To follow a feature from user action to implementation:

1. Read [main.tsx](./src/main.tsx) and [App.tsx](./src/App.tsx) for startup and page orchestration.
2. Read [game.ts](./src/constants/game.ts) for shared constraints.
3. Read [game.ts](./src/store/game.ts) for game state transitions and answer matching.
4. Read [deezer.ts](./src/services/deezer.ts) for data shapes, endpoints, validation, and JSONP transport.
5. Follow the relevant component: [AlbumGuessForm.tsx](./src/components/AlbumGuessForm.tsx), [AlbumHints.tsx](./src/components/AlbumHints.tsx), or [AlbumArtwork.tsx](./src/components/AlbumArtwork.tsx).
6. Check [App.css](./src/App.css) and [index.css](./src/index.css) for the corresponding visual behavior.

When adding a feature, keep network work in the service, game-wide state transitions in Zustand, short-lived UI state in the owning component, and shared limits in the constants module.
