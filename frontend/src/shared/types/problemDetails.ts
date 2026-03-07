export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  code?: string
  errors?: Record<string, string[]>
  [key: string]: unknown
}

export interface NormalizedProblemDetails {
  type: string | null
  title: string | null
  status: number | null
  detail: string | null
  instance: string | null
  code: string | null
  errors: Record<string, string[]>
  raw: ProblemDetails | null
}
