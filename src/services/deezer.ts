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

export type DeezerAlbumSuggestion = DeezerAlbum

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

interface DeezerAlbumSearchResponse {
  data: DeezerAlbum[]
  error?: { message?: string }
}

interface DeezerGenreResponse {
  data: DeezerGenre[]
  error?: { message?: string }
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
    const handleAbort = () => {
      if (settled) return
      settled = true
      config.signal?.removeEventListener?.('abort', handleAbort)
      script.remove()
      reject(new AxiosError('Deezer request was cancelled.', AxiosError.ERR_CANCELED, config))
    }
    const timeoutId = window.setTimeout(() => {
      if (!settled) {
        settled = true
        reject(new AxiosError('Deezer request timed out.', AxiosError.ECONNABORTED, config))
      }
      cleanup()
    }, 15_000)

    Reflect.set(window, callbackName, (data: unknown) => {
      if (settled) {
        cleanup()
        return
      }
      settled = true
      cleanup()
      resolve({
        data,
        status: 200,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config,
        request: script,
      })
    })
    script.onerror = () => {
      if (!settled) {
        settled = true
        reject(new AxiosError('Could not connect to Deezer.', AxiosError.ERR_NETWORK, config))
      }
      cleanup()
    }
    if (config.signal?.aborted) {
      settled = true
      cleanup()
      reject(new AxiosError('Deezer request was cancelled.', AxiosError.ERR_CANCELED, config))
      return
    }
    config.signal?.addEventListener?.('abort', handleAbort)
    document.head.appendChild(script)
  })

async function queryAlbums(
  searchTerm: string,
  limit: number,
  signal?: AbortSignal,
): Promise<DeezerAlbum[]> {
  const response = await axios.get<DeezerAlbumSearchResponse>(`${DEEZER_API_URL}/search/album`, {
    params: { q: searchTerm, limit },
    adapter: deezerJsonpAdapter,
    signal,
  })

  if (response.data.error) {
    throw new Error(response.data.error.message || 'Deezer could not search for albums.')
  }
  if (!Array.isArray(response.data.data)) {
    throw new Error('Deezer returned an invalid album search response.')
  }

  return response.data.data.slice(0, limit)
}

export async function fetchChartAlbums(
  genreId: number,
  signal?: AbortSignal,
): Promise<DeezerAlbum[]> {
  const response = await axios.get<DeezerAlbumSearchResponse>(
    `${DEEZER_API_URL}/chart/${genreId}/albums`,
    {
      params: { limit: ALBUMS_PER_CHART },
      adapter: deezerJsonpAdapter,
      signal,
    },
  )

  if (response.data.error) {
    throw new Error(response.data.error.message || 'Deezer could not load this album chart.')
  }
  if (!Array.isArray(response.data.data)) {
    throw new Error('Deezer returned an invalid album chart response.')
  }

  const albums = response.data.data.slice(0, ALBUMS_PER_CHART)
  if (albums.length === 0) {
    throw new Error('This Deezer chart did not contain any albums.')
  }
  return albums
}

export async function fetchGenres(signal?: AbortSignal): Promise<DeezerGenre[]> {
  const response = await axios.get<DeezerGenreResponse>(`${DEEZER_API_URL}/genre`, {
    adapter: deezerJsonpAdapter,
    signal,
  })

  if (response.data.error) {
    throw new Error(response.data.error.message || 'Deezer could not load genres.')
  }
  if (!Array.isArray(response.data.data)) {
    throw new Error('Deezer returned an invalid genre response.')
  }

  return response.data.data.filter((genre) => genre.id !== 0)
}

export async function searchAlbumSuggestions(
  searchTerm: string,
  signal?: AbortSignal,
): Promise<DeezerAlbumSuggestion[]> {
  return queryAlbums(searchTerm, AUTOCOMPLETE_LIMIT, signal)
}

export async function fetchAlbumDetails(
  albumId: number,
  signal?: AbortSignal,
): Promise<DeezerAlbumDetails> {
  const response = await axios.get<DeezerAlbumDetails & { error?: { message?: string } }>(
    `${DEEZER_API_URL}/album/${albumId}`,
    { adapter: deezerJsonpAdapter, signal },
  )
  if (response.data.error) {
    throw new Error(response.data.error.message || 'Deezer could not load album details.')
  }
  return response.data
}
