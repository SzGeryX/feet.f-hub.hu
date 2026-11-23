import { MAX_TRIES } from '../constants/game'
import type { GameStatus } from '../store/game'

interface AlbumArtworkProps {
  coverUrl?: string
  albumTitle: string
  blurAmount: number
  guessesUsed: number
  isLoading: boolean
  status: GameStatus
}

export function AlbumArtwork({
  coverUrl,
  albumTitle,
  blurAmount,
  guessesUsed,
  isLoading,
  status,
}: AlbumArtworkProps) {
  const hasArtwork = Boolean(coverUrl)
  const isRevealed = status !== 'playing'

  return (
    <section className="artwork-panel" aria-label="Album cover">
      <div className="artwork-header">
        <div className="artwork-title">
          <span className="small-label">ALBUM COVER</span>
          <span className="round-number">TRY {String(guessesUsed + 1).padStart(2, '0')}</span>
        </div>
        <span className="artwork-index">{MAX_TRIES - guessesUsed} GUESSES LEFT</span>
      </div>

      <div className={`artwork-frame${hasArtwork ? ' has-artwork' : ''}`}>
        {coverUrl ? (
          <img
            className="artwork-canvas"
            src={coverUrl}
            alt={isRevealed ? `${albumTitle} album cover` : 'Blurred album cover'}
            style={{ filter: `blur(${isRevealed ? 0 : blurAmount}px)`, transform: 'scale(1.04)' }}
          />
        ) : (
          <div className="artwork-empty" aria-hidden="true">
            <div className="empty-note">
              <span className="empty-note-icon">◉</span>
            </div>
          </div>
        )}
        {isLoading && !coverUrl && (
          <div className="loading-overlay" role="status">
            <span className="loader" />
            Loading album…
          </div>
        )}
        {isRevealed && (
          <div className={`answer-stamp ${status}`}>
            <span>{status === 'won' ? 'CORRECT' : 'ANSWER'}</span>
            <strong>{albumTitle}</strong>
          </div>
        )}
      </div>

      <div className="artwork-footer">
        <span className="footer-caption">
          {status === 'playing' ? 'ALBUM COVER' : 'ROUND COMPLETE'}
        </span>
        <span className="artwork-credit">DEEZER</span>
      </div>
    </section>
  )
}
