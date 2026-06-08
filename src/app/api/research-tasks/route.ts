import { NextResponse } from "next/server";
import { upsertAgentExpansionTask } from "@/lib/agentExpansionTask";
import { loadGraphData, loadTasks, writeTasks } from "@/lib/graphLoader";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const targetNodeId = typeof body?.targetNodeId === "string" ? body.targetNodeId.trim() : "";
    if (!targetNodeId) {
      return NextResponse.json({ error: "targetNodeId is required" }, { status: 400 });
    }

    const graph = loadGraphData();
    const tasks = loadTasks();
    const result = upsertAgentExpansionTask(graph, tasks, targetNodeId);
    if (result.created) {
      writeTasks(result.tasks);
    }

    return NextResponse.json({
      created: result.created,
      task: result.task,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create research task";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
