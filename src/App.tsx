import { useEffect, useState, type ChangeEvent } from 'react'
import { AlbumArtwork } from './components/AlbumArtwork'
import { GamePanel } from './components/GamePanel'
import {
  MAX_TRIES,
} from './constants/game'
import { fetchChartAlbums, fetchGenres } from './services/deezer'
import type { DeezerGenre } from './services/deezer'
import { useGameStore } from './store/game'
import './App.css'

function App() {
  const [selectedGenreId, setSelectedGenreId] = useState(0)
  const [chartRequestId, setChartRequestId] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [genres, setGenres] = useState<DeezerGenre[]>([])
  const [isLoadingGenres, setIsLoadingGenres] = useState(true)
  const [genreError, setGenreError] = useState<Error | null>(null)
  const {
    currentAlbum,
    guesses,
    status,
    hintsRevealed,
    startRound,
    resetRound,
  } = useGameStore()
  const isError = error !== null

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true

    fetchChartAlbums(selectedGenreId, controller.signal)
      .then((albums) => {
        if (!isActive) return
        const randomAlbum = albums[Math.floor(Math.random() * albums.length)]
        startRound(randomAlbum)
      })
      .catch((fetchError: unknown) => {
        if (!isActive || controller.signal.aborted) return
        setError(fetchError instanceof Error ? fetchError : new Error('Could not load the album chart from Deezer.'))
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [chartRequestId, selectedGenreId, startRound])

  useEffect(() => {
    const controller = new AbortController()
    let isActive = true

    fetchGenres(controller.signal)
      .then(setGenres)
      .catch((fetchError: unknown) => {
        if (!isActive || controller.signal.aborted) return
        setGenreError(fetchError instanceof Error ? fetchError : new Error('Could not load Deezer genres.'))
      })
      .finally(() => {
        if (isActive) setIsLoadingGenres(false)
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [])

  const startFreshRound = () => {
    setIsLoading(true)
    setError(null)
    setChartRequestId((requestId) => requestId + 1)
  }

  const nextRound = () => {
    resetRound()
    startFreshRound()
  }

  const selectGenre = (event: ChangeEvent<HTMLSelectElement>) => {
    const genreId = Number(event.target.value)
    if (genreId === selectedGenreId) return
    resetRound()
    setIsLoading(true)
    setError(null)
    setSelectedGenreId(genreId)
    setChartRequestId((requestId) => requestId + 1)
  }

  const blurAmount = currentAlbum
    ? Math.max(0, ((MAX_TRIES - guesses.length) / MAX_TRIES) * 18)
    : 0

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Guess The Album home">
          <span>Guess The Album</span>
        </a>
        <div className="topbar-note">
          Music quiz
        </div>
      </header>

      <main>
        <section className="intro">
          <h1>Name the album.</h1>
          <p className="intro-copy">Identify the album from its cover.</p>
          <div className="genre-picker">
            <label htmlFor="chart-genre">GENRE</label>
            <select id="chart-genre" value={selectedGenreId} onChange={selectGenre}>
              <option value={0}>Global</option>
              {genres.map((genre) => (
                <option key={genre.id} value={genre.id}>{genre.name}</option>
              ))}
            </select>
            {isLoadingGenres && <span className="genre-status" role="status">Loading genres…</span>}
            {genreError && (
              <span className="genre-status error-message" role="status">
                Genre options unavailable. Global chart is still available.
              </span>
            )}
          </div>
        </section>

        <section className="game-layout" aria-label="Album guessing game">
          <AlbumArtwork
            coverUrl={currentAlbum?.cover_xl ?? currentAlbum?.cover_big}
            albumTitle={currentAlbum?.title ?? ''}
            blurAmount={blurAmount}
            guessesUsed={guesses.length}
            isLoading={isLoading || (!currentAlbum && !isError)}
            status={status}
          />
          <GamePanel
            album={currentAlbum}
            guesses={guesses}
            status={status}
            hintsRevealed={hintsRevealed}
            isLoading={isLoading}
            isError={isError}
            error={error}
            onRetry={startFreshRound}
            onNextRound={nextRound}
          />
        </section>
      </main>

      <footer className="page-footer">
        <span>DEEZER CHARTS</span>
      </footer>
    </div>
  )
}

export default App
