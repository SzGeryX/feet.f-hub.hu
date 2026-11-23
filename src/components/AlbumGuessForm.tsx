import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  AUTOCOMPLETE_DEBOUNCE_MS,
  AUTOCOMPLETE_LIMIT,
  AUTOCOMPLETE_MIN_LENGTH,
} from '../constants/game'
import { searchAlbumSuggestions } from '../services/deezer'
import type { DeezerAlbum, DeezerAlbumSuggestion } from '../services/deezer'
import type { GameStatus } from '../store/game'
import { useGameStore } from '../store/game'

interface AlbumSuggestionsResult {
  query: string
  suggestions: DeezerAlbumSuggestion[]
  error: Error | null
}

interface AlbumGuessFormProps {
  album: DeezerAlbum | null
  isLoading: boolean
  status: GameStatus
}

export function AlbumGuessForm({ album, isLoading, status }: AlbumGuessFormProps) {
  const [guess, setGuess] = useState('')
  const [debouncedGuess, setDebouncedGuess] = useState('')
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const [suggestionsResult, setSuggestionsResult] = useState<AlbumSuggestionsResult | null>(null)
  const submitGuess = useGameStore((state) => state.submitGuess)
  const isRoundOver = status !== 'playing'

  useEffect(() => {
    const timerId = window.setTimeout(
      () => setDebouncedGuess(guess.trim()),
      AUTOCOMPLETE_DEBOUNCE_MS,
    )
    return () => window.clearTimeout(timerId)
  }, [guess])

  const shouldFetchSuggestions = Boolean(
    isSuggestionsOpen
    && !isRoundOver
    && debouncedGuess.trim().length >= AUTOCOMPLETE_MIN_LENGTH
    && guess.trim() === debouncedGuess.trim(),
  )

  useEffect(() => {
    if (!shouldFetchSuggestions) return

    const controller = new AbortController()
    let isActive = true
    const query = debouncedGuess.trim()
    searchAlbumSuggestions(query, controller.signal)
      .then((suggestions) => {
        if (isActive) setSuggestionsResult({ query, suggestions, error: null })
      })
      .catch((fetchError: unknown) => {
        if (!isActive || controller.signal.aborted) return
        setSuggestionsResult({
          query,
          suggestions: [],
          error: fetchError instanceof Error
            ? fetchError
            : new Error('Could not load album suggestions.'),
        })
      })

    return () => {
      isActive = false
      controller.abort()
    }
  }, [debouncedGuess, shouldFetchSuggestions])

  const canShowSuggestions = isSuggestionsOpen
    && !isRoundOver
    && guess.trim().length >= AUTOCOMPLETE_MIN_LENGTH
  const isDebouncing = guess.trim().length >= AUTOCOMPLETE_MIN_LENGTH
    && guess.trim() !== debouncedGuess
  const matchingSuggestions = suggestionsResult?.query === debouncedGuess.trim()
    ? suggestionsResult
    : null
  const albumSuggestions = matchingSuggestions?.suggestions ?? []
  const isFetchingSuggestions = shouldFetchSuggestions && !matchingSuggestions
  const isSuggestionsError = Boolean(matchingSuggestions?.error)

  const selectSuggestion = (suggestion: DeezerAlbumSuggestion) => {
    setGuess(suggestion.title)
    setIsSuggestionsOpen(false)
    setActiveSuggestionIndex(-1)
    setSuggestionsResult(null)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!guess.trim()) return
    submitGuess(guess)
    setGuess('')
    setIsSuggestionsOpen(false)
    setActiveSuggestionIndex(-1)
    setSuggestionsResult(null)
  }

  const handleGuessKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsSuggestionsOpen(false)
      setActiveSuggestionIndex(-1)
      setSuggestionsResult(null)
      return
    }

    if (!canShowSuggestions || albumSuggestions.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveSuggestionIndex((index) => (index + 1) % albumSuggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveSuggestionIndex((index) =>
        index <= 0 ? albumSuggestions.length - 1 : index - 1,
      )
    } else if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      event.preventDefault()
      selectSuggestion(albumSuggestions[activeSuggestionIndex])
    }
  }

  return (
    <form onSubmit={handleSubmit}>
        <div className="field-group">
          <label htmlFor="album-guess">ALBUM TITLE <span>*</span></label>
          <div className="autocomplete-field">
            <div className="guess-input-wrap">
              <input
                id="album-guess"
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-expanded={canShowSuggestions}
                aria-controls="album-suggestions"
                aria-activedescendant={activeSuggestionIndex >= 0
                  ? `album-suggestion-${albumSuggestions[activeSuggestionIndex]?.id}`
                  : undefined}
                value={guess}
                onChange={(event) => {
                  setGuess(event.target.value)
                  setIsSuggestionsOpen(true)
                  setActiveSuggestionIndex(-1)
                  setSuggestionsResult(null)
                }}
                onFocus={() => setIsSuggestionsOpen(true)}
                onBlur={() => {
                  setIsSuggestionsOpen(false)
                  setSuggestionsResult(null)
                }}
                onKeyDown={handleGuessKeyDown}
                placeholder="Album title"
                disabled={!album || isLoading || isRoundOver}
                maxLength={100}
              />
              <button
                className="submit-arrow"
                type="submit"
                aria-label="Submit guess"
                disabled={!album || !guess.trim() || isRoundOver}
              >
                ↗
              </button>
            </div>
            {canShowSuggestions && (
              <ul className="autocomplete-list" id="album-suggestions" role="listbox">
                {isDebouncing || isFetchingSuggestions ? (
                  <li className="autocomplete-message" role="status">Searching albums…</li>
                ) : isSuggestionsError ? (
                  <li className="autocomplete-message" role="status">
                    Suggestions are unavailable. You can still submit your guess.
                  </li>
                ) : albumSuggestions.length > 0 ? (
                  albumSuggestions.slice(0, AUTOCOMPLETE_LIMIT).map((suggestion, index) => (
                    <li key={suggestion.id} role="presentation">
                      <button
                        id={`album-suggestion-${suggestion.id}`}
                        className={`autocomplete-option${index === activeSuggestionIndex ? ' active' : ''}`}
                        type="button"
                        role="option"
                        aria-selected={index === activeSuggestionIndex}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectSuggestion(suggestion)}
                      >
                        <span>{suggestion.title}</span>
                        <span className="suggestion-enter">{suggestion.artist.name}</span>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="autocomplete-message" role="status">
                    No matching albums. You can still submit your guess.
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
        {status === 'won' && <p className="message success-message">Correct.</p>}
        {status === 'lost' && <p className="message error-message">No guesses left.</p>}
    </form>
  )
}
