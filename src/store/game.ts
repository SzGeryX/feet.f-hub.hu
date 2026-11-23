import { create } from 'zustand'
import { MAX_HINTS, MAX_TRIES } from '../constants/game'
import type { DeezerAlbum } from '../services/deezer'

export type GameStatus = 'playing' | 'won' | 'lost'

interface GameState {
  currentAlbum: DeezerAlbum | null
  guesses: string[]
  status: GameStatus
  hintsRevealed: number
  roundsPlayed: number
  startRound: (album: DeezerAlbum) => void
  submitGuess: (guess: string) => void
  revealHint: () => void
  resetRound: () => void
}

function normalizeAnswer(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export const useGameStore = create<GameState>((set, get) => ({
  currentAlbum: null,
  guesses: [],
  status: 'playing',
  hintsRevealed: 0,
  roundsPlayed: 0,
  startRound: (album) => {
    if (get().currentAlbum) return
    set((state) => ({
      currentAlbum: album,
      guesses: [],
      status: 'playing',
      hintsRevealed: 0,
      roundsPlayed: state.roundsPlayed + 1,
    }))
  },
  submitGuess: (guess) => {
    const state = get()
    if (!state.currentAlbum || state.status !== 'playing' || !guess.trim()) return

    const guesses = [...state.guesses, guess.trim()]
    const isCorrect = normalizeAnswer(guess) === normalizeAnswer(state.currentAlbum.title)
    set({
      guesses,
      status: isCorrect ? 'won' : guesses.length >= MAX_TRIES ? 'lost' : 'playing',
    })
  },
  revealHint: () => {
    set((state) => ({
      hintsRevealed: Math.min(state.hintsRevealed + 1, MAX_HINTS),
    }))
  },
  resetRound: () => {
    set({
      currentAlbum: null,
      guesses: [],
      status: 'playing',
      hintsRevealed: 0,
    })
  },
}))
