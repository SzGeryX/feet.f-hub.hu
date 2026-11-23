import { useEffect, useState } from 'react'
import { MAX_HINTS } from '../constants/game'
import { fetchAlbumDetails } from '../services/deezer'
import type { DeezerAlbum, DeezerAlbumDetails } from '../services/deezer'
import { useGameStore } from '../store/game'

interface AlbumDetailsResult {
  albumId: number
  details: DeezerAlbumDetails | null
  error: Error | null
}

interface AlbumHintsProps {
  album: DeezerAlbum | null
  hintsRevealed: number
  isLoading: boolean
}

function getHintValues(album: DeezerAlbum, releaseDate?: string, artists?: string[]) {
  return [
    { label: 'RELEASE YEAR', value: releaseDate?.slice(0, 4) || 'Release year not listed' },
    { label: 'GENRE', value: 'album genre' },
    { label: 'ARTIST(S)', value: artists?.join(', ') || album.artist.name },
  ]
}

export function AlbumHints({ album, hintsRevealed, isLoading }: AlbumHintsProps) {
  const [albumDetailsResult, setAlbumDetailsResult] = useState<AlbumDetailsResult | null>(null)
  const [detailsRetry, setDetailsRetry] = useState(0)
  const revealHint = useGameStore((state) => state.revealHint)
  const albumId = album?.id
  const shouldFetchAlbumDetails = Boolean(albumId && hintsRevealed > 0)

  useEffect(() => {
    if (!albumId || !shouldFetchAlbumDetails) return

    const controller = new AbortController()
    let isActive = true
    fetchAlbumDetails(albumId, controller.signal)
      .then((details) => {
        if (isActive) setAlbumDetailsResult({ albumId, details, error: null })
      })
      .catch((fetchError: unknown) => {
        if (!isActive || controller.signal.aborted) return
        setAlbumDetailsResult({
          albumId,
          details: null,
          error: fetchError instanceof Error
            ? fetchError
            : new Error('Could not load album details.'),
        })
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [albumId, detailsRetry, shouldFetchAlbumDetails])

  const matchingDetails = albumDetailsResult?.albumId === albumId
    ? albumDetailsResult
    : null
  const albumDetails = matchingDetails?.details ?? null
  const isLoadingDetails = shouldFetchAlbumDetails
    && (!matchingDetails || (!matchingDetails.details && !matchingDetails.error))
  const isDetailsError = Boolean(matchingDetails?.error)
  const detailsArtists = albumDetails?.contributors?.map((artist) => artist.name) ?? []
  const artists = [...new Set(
    [albumDetails?.artist?.name ?? album?.artist.name, ...detailsArtists]
      .filter((artist): artist is string => Boolean(artist)),
  )]
  const hints = album
    ? getHintValues(album, albumDetails?.release_date, artists)
    : []

  if (albumDetails?.genres?.data.length) {
    hints[1].value = albumDetails.genres.data.map((genre) => genre.name).join(', ')
  } else if (albumDetails) {
    hints[1].value = 'Genre not listed'
  }

  return (
    <section className="hint-section">
      <div className="hint-heading">
        <span className="small-label">HINTS</span>
        <span className="history-count">{hintsRevealed} / {MAX_HINTS} USED</span>
      </div>
      <button
        className="text-button"
        type="button"
        onClick={revealHint}
        disabled={!album || isLoading || hintsRevealed >= MAX_HINTS}
      >
        {hintsRevealed >= MAX_HINTS ? 'No hints left' : 'Show next hint'}
        {hintsRevealed < MAX_HINTS && <span>↗</span>}
      </button>
      {hintsRevealed > 0 && (
        <ol className="hint-list" aria-live="polite">
          {hints.slice(0, hintsRevealed).map((hint, index) => (
            <li key={hint.label}>
              <span className="hint-number">0{index + 1}</span>
              <span className="hint-content">
                <span>{hint.label}</span>
                <strong>
                  {index === 0 && isLoadingDetails
                    ? 'Finding release year…'
                    : index === 1 && isLoadingDetails
                      ? 'Finding genre…'
                      : isDetailsError && index < 2
                        ? 'Details unavailable'
                        : hint.value}
                </strong>
              </span>
            </li>
          ))}
        </ol>
      )}
      {isDetailsError && (
        <p className="message error-message">
          Could not load album clues.{' '}
          <button
            className="inline-button"
            type="button"
            onClick={() => {
              setAlbumDetailsResult(null)
              setDetailsRetry((attempt) => attempt + 1)
            }}
          >
            Retry
          </button>
        </p>
      )}
    </section>
  )
}
