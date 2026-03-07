export const uiKitContract = {
  table: {
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50] as const,
  },
  filters: {
    minQueryLength: 2,
    maxQueryLength: 100,
  },
  interactions: {
    simulatedLatencyMs: 320,
  },
} as const
