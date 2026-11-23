import axios, { AxiosError, AxiosHeaders, type AxiosAdapter } from 'axios'
import { ALBUMS_PER_CHART, AUTOCOMPLETE_LIMIT } from '../constants/game'

export interface DeezerArtist {
  id: number
  name: string
}

export interface DeezerAlbum {
  id: number
  title: string
  artist: DeezerArtist
  cover_medium?: string
  cover_big?: string
  cover_xl?: string
}

export interface DeezerGenre {
  id: number
  name: string
}

export interface DeezerAlbumDetails {
  release_date?: string
  artist?: DeezerArtist
  contributors?: DeezerArtist[]
  genres?: {
    data: Array<{ id: number; name: string }>
  }
}

interface DeezerErrorResponse {
  error?: { message?: string }
}

interface DeezerListResponse<T> extends DeezerErrorResponse {
  data?: T[]
}

interface DeezerRequestOptions {
  params?: Record<string, string | number>
  signal?: AbortSignal
  errorMessage: string
}

interface DeezerListRequestOptions extends DeezerRequestOptions {
  invalidResponseMessage: string
}

const DEEZER_API_URL = 'https://api.deezer.com'

const deezerJsonpAdapter: AxiosAdapter = (config) =>
  new Promise((resolve, reject) => {
    let settled = false
    const callbackName = `deezer_jsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const params = new URLSearchParams()
    const requestParams = config.params as Record<string, string | number | boolean> | undefined
    for (const [key, value] of Object.entries(requestParams ?? {})) {
      params.set(key, String(value))
    }
    params.set('output', 'jsonp')
    params.set('callback', callbackName)

    const script = document.createElement('script')
    script.async = true
    script.src = `${config.url}?${params.toString()}`

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      Reflect.deleteProperty(window, callbackName)
      script.remove()
      config.signal?.removeEventListener?.('abort', handleAbort)
    }
    const settle = (action: () => void, cleanupAfter = true) => {
      if (settled) {
        if (cleanupAfter) cleanup()
        return
      }
      settled = true
      action()
      if (cleanupAfter) cleanup()
    }
    const handleAbort = () => {
      settle(() => {
        config.signal?.removeEventListener?.('abort', handleAbort)
        script.remove()
        reject(new AxiosError('Deezer request was cancelled.', AxiosError.ERR_CANCELED, config))
      }, false)
    }
    const timeoutId = window.setTimeout(
      () => settle(() => reject(new AxiosError('Deezer request timed out.', AxiosError.ECONNABORTED, config))),
      15_000,
    )

    Reflect.set(window, callbackName, (data: unknown) => {
      settle(() =>
        resolve({
          data,
          status: 200,
          statusText: 'OK',
          headers: new AxiosHeaders(),
          config,
          request: script,
        }),
      )
    })
    script.onerror = () => {
      settle(() => reject(new AxiosError('Could not connect to Deezer.', AxiosError.ERR_NETWORK, config)))
    }
    if (config.signal?.aborted) {
      handleAbort()
      return
    }
    config.signal?.addEventListener?.('abort', handleAbort)
    document.head.appendChild(script)
  })

async function requestDeezer<T>(
  endpoint: string,
  { params, signal, errorMessage }: DeezerRequestOptions,
): Promise<T> {
  const response = await axios.get<T & DeezerErrorResponse>(`${DEEZER_API_URL}${endpoint}`, {
    params,
    adapter: deezerJsonpAdapter,
    signal,
  })

  if (response.data.error) {
    throw new Error(response.data.error.message || errorMessage)
  }
  return response.data
}

async function requestDeezerList<T>(
  endpoint: string,
  options: DeezerListRequestOptions,
): Promise<T[]> {
  const response = await requestDeezer<DeezerListResponse<T>>(endpoint, options)
  if (!Array.isArray(response.data)) {
    throw new Error(options.invalidResponseMessage)
  }
  return response.data
}

export async function fetchChartAlbums(
  genreId: number,
  signal?: AbortSignal,
): Promise<DeezerAlbum[]> {
  const albums = await requestDeezerList<DeezerAlbum>(`/chart/${genreId}/albums`, {
    params: { limit: ALBUMS_PER_CHART },
    signal,
    errorMessage: 'Deezer could not load this album chart.',
    invalidResponseMessage: 'Deezer returned an invalid album chart response.',
  })
  if (albums.length === 0) {
    throw new Error('This Deezer chart did not contain any albums.')
  }
  return albums.slice(0, ALBUMS_PER_CHART)
}

export async function fetchGenres(signal?: AbortSignal): Promise<DeezerGenre[]> {
  const genres = await requestDeezerList<DeezerGenre>('/genre', {
    signal,
    errorMessage: 'Deezer could not load genres.',
    invalidResponseMessage: 'Deezer returned an invalid genre response.',
  })
  return genres.filter((genre) => genre.id !== 0)
}

export async function searchAlbumSuggestions(
  searchTerm: string,
  signal?: AbortSignal,
): Promise<DeezerAlbum[]> {
  const albums = await requestDeezerList<DeezerAlbum>('/search/album', {
    params: { q: searchTerm, limit: AUTOCOMPLETE_LIMIT },
    signal,
    errorMessage: 'Deezer could not search for albums.',
    invalidResponseMessage: 'Deezer returned an invalid album search response.',
  })
  return albums.slice(0, AUTOCOMPLETE_LIMIT)
}

export async function fetchAlbumDetails(
  albumId: number,
  signal?: AbortSignal,
): Promise<DeezerAlbumDetails> {
  return requestDeezer<DeezerAlbumDetails>(`/album/${albumId}`, {
    signal,
    errorMessage: 'Deezer could not load album details.',
  })
}
