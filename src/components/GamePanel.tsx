import { MAX_TRIES } from '../constants/game'
import type { DeezerAlbum } from '../services/deezer'
import type { GameStatus } from '../store/game'
import { useGameStore } from '../store/game'
import { AlbumGuessForm } from './AlbumGuessForm'
import { AlbumHints } from './AlbumHints'
import { GuessHistory } from './GuessHistory'

interface GamePanelProps {
  album: DeezerAlbum | null
  guesses: string[]
  status: GameStatus
  hintsRevealed: number
  isLoading: boolean
  isError: boolean
  error: Error | null
  onRetry: () => void
  onNextRound: () => void
}

export function GamePanel({
  album,
  guesses,
  status,
  hintsRevealed,
  isLoading,
  isError,
  error,
  onRetry,
  onNextRound,
}: GamePanelProps) {
  const roundsPlayed = useGameStore((state) => state.roundsPlayed)
  const isRoundOver = status !== 'playing'

  return (
    <aside className="game-card" aria-label="Guess the album">
      <div className="card-heading">
        <span className="small-label">GUESS THE ALBUM</span>
        <span className="heading-rule" />
        <span className="round-number">{guesses.length}/{MAX_TRIES}</span>
      </div>

      {isError ? (
        <div className="api-error" role="alert">
          <p>{error?.message || 'Could not load the album chart.'}</p>
          <button className="text-button" type="button" onClick={onRetry}>
            Try again <span>↻</span>
          </button>
        </div>
      ) : (
        <>
          <AlbumGuessForm
            key={roundsPlayed}
            album={album}
            isLoading={isLoading}
            status={status}
          />
          <div className="round-tools">
            {isRoundOver ? (
              <button className="primary-button" type="button" onClick={onNextRound}>
                <span>Play next round</span><span className="button-arrow">→</span>
              </button>
            ) : (
              <AlbumHints
                key={roundsPlayed}
                album={album}
                hintsRevealed={hintsRevealed}
                isLoading={isLoading}
              />
            )}
          </div>
        </>
      )}

      {album && <GuessHistory guesses={guesses} answer={album.title} />}
    </aside>
  )
}
