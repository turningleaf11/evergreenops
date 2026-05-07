import React from "react";

export default function AiHubDocsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">AI Hub Architecture & Setup Guide</h1>
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Structure Overview</h2>
        <p>The AI Hub is a tab inside EvergreenOps that surfaces the ClawBuddy task board and agent status.</p>
        <pre className="bg-muted rounded p-4 overflow-x-auto">
{`evergreenops (Ops HQ)
  ├─ src/pages/AiHubPage.tsx  ← UI for AI Hub
  ├─ src/components/…         ← UI components
  └─ src/pages/AiHubDocsPage.tsx ← This documentation

ClawBuddy (Task Board)
  ├─ Supabase tables (tasks, agents)
  └─ API (clawbuddy-api) – provides tasks & agent data

Claude Worker
  ├─ watches Supabase for tasks assigned to Claude
  └─ executes via Anthropic API and writes results back`}
        </pre>
      </section>
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Setup Steps</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>Clone the <code>evergreenops</code> repo and run <code>npm install</code>.</li>
          <li>Deploy to Vercel – set environment variables for Supabase URL & key.</li>
          <li>Configure ClawBuddy API credentials (see <code>.openclaw/openclaw.json</code>).</li>
          <li>Start the Claude worker (PM2 commands saved in <code>claude-worker/commands.md</code>).</li>
          <li>Open <code>/ai-hub</code> in the app – you’ll see the task board and agent panel.</li>
        </ol>
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-2">References</h2>
        <ul className="list-disc list-inside">
          <li><a href="/ai-hub" className="underline">AI Hub tab</a></li>
          <li><a href="https://github.com/turningleaf11/clawbuddy-command-center" target="_blank" rel="noopener" className="underline">ClawBuddy repo</a></li>
          <li><a href="https://console.anthropic.com" target="_blank" rel="noopener" className="underline">Anthropic API</a></li>
        </ul>
      </section>
    </div>
  );
}
