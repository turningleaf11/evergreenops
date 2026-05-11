import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Find all council sessions that are "running"
    const { data: sessions, error: sessionError } = await supabase
      .from("council_sessions")
      .select("id, question, participants, status")
      .eq("status", "running")

    if (sessionError) throw sessionError

    for (const session of sessions || []) {
      const participants = session.participants as any[]
      const sessionId = session.id

      // Get all tasks for this council session
      const { data: tasks } = await supabase
        .from("agent_tasks")
        .select("id, assigned_to, status, context")
        .eq("context->>council_session_id", sessionId)
        .order("context->>council_position", { ascending: true })

      // Find current position (first pending or the highest completed)
      let currentPosition = 0
      let completedCount = 0
      
      for (const task of tasks || []) {
        if (task.status === "done") {
          completedCount++
          const pos = task.context?.council_position
          if (typeof pos === "number" && pos >= currentPosition) {
            currentPosition = pos + 1
          }
        } else if (task.status === "pending" || task.status === "doing") {
          const pos = task.context?.council_position
          if (typeof pos === "number") {
            currentPosition = pos
            break
          }
        }
      }

      // If all participants done, mark session done
      if (completedCount >= participants.length) {
        await supabase.from("council_sessions").update({ status: "done" }).eq("id", sessionId)
        continue
      }

      // Advance next participant
      const nextPos = completedCount
      if (nextPos < participants.length) {
        const nextParticipant = participants[nextPos]
        
        // Find the task for this participant and set to pending
        const { data: nextTask } = await supabase
          .from("agent_tasks")
          .select("id")
          .eq("context->>council_session_id", sessionId)
          .eq("context->>council_position", nextPos)
          .in("status", ["backlog", "needs_input"])
          .limit(1)
          .single()

        if (nextTask) {
          await supabase
            .from("agent_tasks")
            .update({ status: "pending" })
            .eq("id", nextTask.id)
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
