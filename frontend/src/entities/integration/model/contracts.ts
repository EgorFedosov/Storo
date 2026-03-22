export const integrationContract = {
  supportTicket: {
    fixedProvider: 'dropbox',
  },
} as const

export type IntegrationProvider = typeof integrationContract.supportTicket.fixedProvider

