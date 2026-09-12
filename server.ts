// ✅ Server entry point for Hostinger Node.js deployment
import { createRequestHandler } from '@tanstack/start'
import { createMemoryHistory } from '@tanstack/react-router'
import { createRouter } from './src/router'

const handler = createRequestHandler({
  createRouter: () =>
    createRouter({
      history: createMemoryHistory({
        initialEntries: ['/'],
      }),
    }),
})

export default handler
