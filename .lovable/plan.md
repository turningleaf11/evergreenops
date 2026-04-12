

# Connect AI Strategy Companion to Lovable AI

## Overview
Replace the mock `getMockResponse` function with a real AI-powered streaming chat using the Lovable AI Gateway via a Supabase Edge Function. The `LOVABLE_API_KEY` is already available.

## What Changes

### 1. Create Edge Function (`supabase/functions/ceo-chat/index.ts`)
- Accepts `{ messages }` from the client
- Prepends the CEO context as a system prompt (sent from client)
- Calls `https://ai.gateway.lovable.dev/v1/chat/completions` with streaming enabled
- Uses `google/gemini-3-flash-preview` model
- Handles CORS, 429 rate limits, 402 payment errors
- Returns SSE stream directly to client

### 2. Update `src/components/CeoAiChat.tsx`
- Remove `getMockResponse` function
- Add SSE streaming logic that calls the edge function
- Stream tokens into the assistant message in real-time (token-by-token rendering)
- Send full conversation history + system context on each request
- Handle 429/402 errors with user-friendly messages
- Keep `buildSystemContext` — it becomes the system prompt sent to the edge function

### 3. No other files change
The CEO context, dashboard, and all other components remain untouched.

## Technical Details

**Edge function flow:**
```text
Client → POST /functions/v1/ceo-chat { messages: [...] }
       → Edge function prepends system prompt
       → Streams from Lovable AI Gateway
       → SSE response back to client
```

**Streaming in React:**
- On send: append user message, create empty assistant message
- Parse SSE line-by-line, extract `delta.content` tokens
- Update last assistant message content progressively
- On `[DONE]`, mark loading complete

**System prompt** stays in the edge function (moved from client-side `buildSystemContext`). The client sends the CEO context data as part of the request body, and the edge function builds the system prompt server-side.

## Build Order
1. Create `supabase/functions/ceo-chat/index.ts` with streaming + CORS
2. Update `CeoAiChat.tsx` — replace mock with streaming SSE client
3. Test end-to-end

