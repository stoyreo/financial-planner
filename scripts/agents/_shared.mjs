// scripts/agents/_shared.mjs
import Anthropic from "@anthropic-ai/sdk";

export const HAIKU = "claude-haiku-4-5-20251001";
export const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Call Haiku and force it to emit a JSON blob via a single tool.
 * Returns the parsed JSON (the tool's `input`) or throws.
 */
export async function callAgent({ system, userJson, schema, maxTokens = 512 }) {
  const resp = await client.messages.create({
    model: HAIKU,
    max_tokens: maxTokens,
    system,
    tools: [{
      name: "emit_result",
      description: "Emit the structured result of this agent's work.",
      input_schema: schema,
    }],
    tool_choice: { type: "tool", name: "emit_result" },
    messages: [{
      role: "user",
      content: `Previous agent output (JSON):\n\`\`\`json\n${JSON.stringify(userJson, null, 2)}\n\`\`\`\nDo your job and call emit_result.`,
    }],
  });

  const toolUse = resp.content.find((b) => b.type === "tool_use");
  if (!toolUse) throw new Error("Agent did not emit a tool_use block");
  return toolUse.input;
}

export function log(agent, obj) {
  const stamp = new Date().toISOString();
  console.log(`[${stamp}] [${agent}]`, JSON.stringify(obj));
}
