import Anthropic from "@anthropic-ai/sdk";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

export const runtime = "nodejs";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ---- Tool schema exposed to Claude ----
const tools: Anthropic.Messages.Tool[] = [
  {
    name: "get_current_occupancy",
    description: "Returns current occupancy count based on gesture events from Arduino.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "reset_current_occupancy",
    description: "Resets the gesture-based occupancy counters to zero.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_serial_status",
    description: "Returns current serial configuration and any connection error.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_building_statistics",
    description: "Queries occupancy data for a specific building and date/time window.",
    input_schema: {
      type: "object",
      properties: {
        building: { type: ["string", "null"] },
        date: { type: "string", description: "MM/DD/YY e.g. 07/24/05" },
        start_time: { type: ["string", "null"], description: "HH:MM:SS" },
        end_time: { type: ["string", "null"], description: "HH:MM:SS" },
        file_path: { type: ["string", "null"], description: "Optional preprocessed CSV file path on server" },
      },
      required: ["date"],
      additionalProperties: false,
    },
  },
  {
    name: "preprocess_occupancy_data",
    description: "Preprocess raw flow data via Arduino and save occupancy CSV in results folder.",
    input_schema: {
      type: "object",
      properties: {
        input_path: { type: "string", description: "Path to raw flow CSV on server filesystem" },
      },
      required: ["input_path"],
      additionalProperties: false,
    },
  },
];

// ---- Bridge: call Python MCP tool runner ----
function callMcpTool(tool: string, args: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const python = process.env.MCP_PYTHON || "python3";
    const script = process.env.MCP_CALL_SCRIPT || path.join(process.cwd(), "app", "scripts", "mcp_call.py");

    const port = process.env.ARDUINO_PORT || "";
    const baud = process.env.ARDUINO_BAUD || "";

    const proc = spawn(python, [
      script,
      "--tool",
      tool,
      "--args",
      JSON.stringify(args ?? {}),
      ...(port ? ["--port", port] : []),
      ...(baud ? ["--baud", baud] : []),
    ]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`mcp_call failed (code=${code}): ${stderr || stdout}`));
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        if (!parsed.ok) return reject(new Error(parsed.error || "Unknown MCP error"));
        resolve(parsed.output);
      } catch (e) {
        reject(new Error(`Failed to parse MCP output: ${stdout}`));
      }
    });
  });
}

// ---- (Optional) accept file uploads using multipart/form-data ----
async function maybeSaveUploadedFile(req: Request): Promise<string | null> {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) return null;

  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) return null;

  const buf = Buffer.from(await file.arrayBuffer());
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "uploads-"));
  const filePath = path.join(dir, file.name);
  await fs.writeFile(filePath, buf);

  return filePath;
}

// ---- Main route ----
export async function POST(req: Request) {
  // If you want uploads, client must send multipart/form-data.
  const uploadedPath = await maybeSaveUploadedFile(req);

  // If not multipart, fall back to JSON body
  let body: any = null;
  if (!uploadedPath) {
    body = await req.json();
  } else {
    // If multipart, you can also include "messages" as a JSON string field
    // e.g. form.append("payload", JSON.stringify({messages, buildingData}))
    const form = await req.formData();
    const payloadStr = (form.get("payload") as string) || "{}";
    body = JSON.parse(payloadStr);
  }

  const messages = body?.messages ?? [];
  const buildingData = body?.buildingData;

  // Convert incoming messages to Anthropic format
  // Your UI uses role: "user" | "assistant"
  const claudeMessages: Anthropic.Messages.MessageParam[] = messages.map((m: any) => ({
    role: m.role,
    content: m.content ?? m.text ?? "",
  }));

  const system = buildingData
    ? `You are a building analytics assistant. Building context:\n${JSON.stringify(buildingData).slice(0, 8000)}`
    : "You are a building analytics assistant.";

  // Tool loop: let Claude call tools, execute them, feed results back
  let loopMessages = claudeMessages;

  for (let step = 0; step < 6; step++) {
    const resp = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-3-5-sonnet-20240620",
      max_tokens: 900,
      system,
      tools,
      messages: loopMessages,
    });

    // If Claude produced text only, return it
    const toolUses = resp.content.filter((c) => c.type === "tool_use");
    const texts = resp.content.filter((c) => c.type === "text").map((c: any) => c.text).join("\n");

    if (toolUses.length === 0) {
      return Response.json({ text: texts });
    }

    // Append assistant message (including tool_use blocks)
    loopMessages = [
      ...loopMessages,
      { role: "assistant", content: resp.content as any },
    ];

    // Execute each tool_use and append tool_result blocks
    const toolResults: any[] = [];
    for (const tu of toolUses as any[]) {
      const toolName = tu.name as string;
      const input = tu.input ?? {};

      // If user uploaded a file, allow Claude to preprocess it easily:
      // (Only if the tool expects input_path)
      const patchedInput =
        uploadedPath && toolName === "preprocess_occupancy_data"
          ? { ...input, input_path: uploadedPath }
          : input;

      let output: any;
      try {
        output = await callMcpTool(toolName, patchedInput);
      } catch (e: any) {
        output = `Tool error: ${e?.message ?? String(e)}`;
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: typeof output === "string" ? output : JSON.stringify(output),
      });
    }

    loopMessages = [
      ...loopMessages,
      { role: "user", content: toolResults },
    ];
  }

  return Response.json({ text: "Tool loop exceeded max steps." }, { status: 500 });
}