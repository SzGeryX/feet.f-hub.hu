import { MAX_TRIES } from '../constants/game'

interface GuessHistoryProps {
  guesses: string[]
  answer: string
}

export function GuessHistory({ guesses, answer }: GuessHistoryProps) {
  const normalizedAnswer = answer
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  return (
    <section className="guess-history" aria-label="Your guesses">
      <div className="history-heading">
        <span className="small-label">GUESSES</span>
        <span className="history-count">{guesses.length} / {MAX_TRIES}</span>
      </div>
      {guesses.length === 0 ? (
        <div className="history-empty">No guesses yet.</div>
      ) : (
        <ol className="guess-list">
          {guesses.map((guess, index) => {
            const isCorrect = guess
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '') === normalizedAnswer
            return (
              <li className={isCorrect ? 'is-correct' : ''} key={`${guess}-${index}`}>
                <span className="guess-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="guess-text">{guess}</span>
                <span className="guess-result" aria-label={isCorrect ? 'Correct' : 'Incorrect'}>
                  {isCorrect ? '✓' : '×'}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      <div className="attempt-meter" aria-label={`${guesses.length} of ${MAX_TRIES} guesses used`}>
        {Array.from({ length: MAX_TRIES }, (_, index) => (
          <span
            className={index < guesses.length ? (index === guesses.length - 1 ? 'meter-current' : 'meter-used') : ''}
            key={index}
          />
        ))}
      </div>
    </section>
  )
}
