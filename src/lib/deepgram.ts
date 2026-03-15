import { DeepgramClient } from '@deepgram/sdk'

// Server-side only — never import in client components
export const deepgramClient = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY! })
