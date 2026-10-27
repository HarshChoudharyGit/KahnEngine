import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage, AIMessage, ToolMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { getToolsForAgent } from './tools.js';
import { resolveExpressions } from '../executor.js';

let activeMockProvider = null;

/**
 * Test hook to register a mock AI provider for deterministic tests.
 */
export function setMockAIProvider(fn) {
  activeMockProvider = fn;
}

/**
 * Clear any active mock AI provider.
 */
export function clearMockAIProvider() {
  activeMockProvider = null;
}

/**
 * Normalizes an AI Agent response into the standard Kahn Engine output contract:
 * {
 *   text: "The main human-readable AI response",
 *   output: "The main AI response or structured result",
 *   response: "The main AI response",
 *   data: {},
 *   structured: null,
 *   model: "actual model identifier",
 *   usage: { inputTokens: 0, outputTokens: 0 }
 * }
 */
export function normalizeAgentOutput({
  rawText,
  structuredOutput = false,
  outputSchema = '',
  model = 'gemini-3-flash',
  usage = null,
  toolsUsed = [],
  toolExecutions = [],
}) {
  let parsedJson = null;

  if (structuredOutput) {
    if (typeof rawText === 'object' && rawText !== null) {
      parsedJson = rawText;
      rawText = JSON.stringify(parsedJson, null, 2);
    } else if (typeof rawText === 'string') {
      const trimmed = rawText.trim();
      // Remove optional markdown code fences ```json ... ```
      const cleaned = trimmed
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

      try {
        parsedJson = JSON.parse(cleaned);
      } catch (parseErr) {
        throw new Error(
          `AI Agent output validation failed: Expected valid JSON structured output, but received: ${parseErr.message}. Output was: "${trimmed.slice(0, 200)}"`
        );
      }
    }
  }

  const normalizedUsage = usage && (usage.inputTokens !== undefined || usage.outputTokens !== undefined)
    ? {
      inputTokens: Number(usage.inputTokens) || 0,
      outputTokens: Number(usage.outputTokens) || 0,
    }
    : undefined;

  if (structuredOutput && parsedJson !== null) {
    return {
      text: typeof rawText === 'string' ? rawText : JSON.stringify(parsedJson, null, 2),
      output: parsedJson,
      response: typeof rawText === 'string' ? rawText : JSON.stringify(parsedJson, null, 2),
      data: parsedJson,
      structured: parsedJson,
      model,
      ...(normalizedUsage ? { usage: normalizedUsage } : {}),
      ...(toolsUsed.length > 0 ? { toolsUsed, toolExecutions } : {}),
    };
  }

  const textOutput = typeof rawText === 'string' ? rawText : String(rawText || '');
  return {
    text: textOutput,
    output: textOutput,
    response: textOutput,
    data: {},
    structured: null,
    model,
    ...(normalizedUsage ? { usage: normalizedUsage } : {}),
    ...(toolsUsed.length > 0 ? { toolsUsed, toolExecutions } : {}),
  };
}

// In-memory conversation buffer keyed by executionId or workflow context
const executionMemoryStore = new Map();

/**
 * Normalizes user-specified model names into valid Google Gemini identifiers.
 */
function normalizeGeminiModel(name) {
  if (!name || typeof name !== 'string') return 'gemini-3.5-flash';
  const clean = name.toLowerCase().trim();
  if (clean.includes('3.8')) return 'gemini-3.8-flash';
  if (clean.includes('lite')) return 'gemini-3.5-flash-lite';
  if (clean.includes('pro')) return 'gemini-2.5-pro';
  return 'gemini-3.5-flash';
}

/**
 * Executes a production-ready, general-purpose AI Agent task exclusively using Google Gemini.
 */
export async function executeLangGraphAgent({ node, config, context, log = console.log, executionId }) {
  const activeConfig = config || resolveExpressions(node.data?.configuration || node.data || {}, context);

  // 1. Resolve prompt expressions using the execution context
  const systemInstructions = resolveExpressions(
    activeConfig.systemInstructions ||
    'You are a production-ready, general-purpose AI assistant in the Kahn Engine workflow automation engine powered by Google Gemini. Follow instructions carefully and deliver precise outputs.',
    context
  );

  let promptText = resolveExpressions(
    activeConfig.prompt || '',
    context
  );

  // If prompt is empty, report error
  if (!promptText || !promptText.trim()) {
    throw new Error('AI Agent error: Prompt / input instructions are required.');
  }

  // 2. Gather inputs from predecessor nodes
  const predecessorInputs = {};
  const predIds = node._predecessorIds || [];
  for (const pId of predIds) {
    const predNode = context.nodes?.[pId];
    const out = context.outputs?.[pId] ?? predNode?.output;
    if (out !== undefined) {
      predecessorInputs[pId] = out;
    }
  }

  const rawModelName = activeConfig.model || 'gemini-1.5-flash';
  const modelName = normalizeGeminiModel(rawModelName);
  const temperature = typeof activeConfig.temperature === 'number' ? activeConfig.temperature : 0.7;
  const maxTokens = Number(activeConfig.maxOutputTokens || 1000);
  const structuredOutput = Boolean(activeConfig.structuredOutput);
  const outputSchema = activeConfig.outputSchema || '';
  const enabledTools = Array.isArray(activeConfig.tools) ? activeConfig.tools : [];
  const enableMemory = Boolean(activeConfig.memory || activeConfig.enableMemory);

  log(`[AI Agent] Initializing Google Gemini execution (Model: ${modelName}, Temperature: ${temperature}, Tools: [${enabledTools.join(', ')}], Structured JSON: ${structuredOutput})`);

  // 3. Check for mock provider (used for automated deterministic tests)
  if (activeMockProvider) {
    log(`[AI Agent] Executing via mock provider adapter...`);
    const mockResponse = await activeMockProvider({
      prompt: promptText,
      systemInstructions,
      model: modelName,
      temperature,
      maxTokens,
      structuredOutput,
      outputSchema,
      tools: enabledTools,
      context,
      predecessorInputs,
      node,
      log,
    });

    if (mockResponse && typeof mockResponse === 'object' && ('output' in mockResponse || 'text' in mockResponse || 'structured' in mockResponse)) {
      return normalizeAgentOutput({
        rawText: mockResponse.structured || mockResponse.text || mockResponse.output,
        structuredOutput,
        outputSchema,
        model: mockResponse.model || modelName,
        usage: mockResponse.usage || { inputTokens: 45, outputTokens: 30 },
        toolsUsed: mockResponse.toolsUsed || [],
        toolExecutions: mockResponse.toolExecutions || [],
      });
    }

    return normalizeAgentOutput({
      rawText: mockResponse,
      structuredOutput,
      outputSchema,
      model: modelName,
      usage: { inputTokens: 50, outputTokens: 25 },
    });
  }

  // 4. Live Provider Execution (Google Gemini)
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    activeConfig.apiKey;

  if (!apiKey || apiKey.includes('placeholder') || apiKey.trim() === '') {
    log(`[AI Agent Error] Missing Gemini API key. Configure GEMINI_API_KEY (or GOOGLE_API_KEY) in server .env.`, 'ERROR');
    throw new Error('AI Agent error: Google Gemini API key is missing. Set GEMINI_API_KEY in server .env or workflow node configuration.');
  }

  // Request timeout controller (30 seconds)
  const controller = new AbortController();
  const timeoutMs = 30000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    log(`[AI Agent] Connecting to Google Gemini (${modelName})...`);

    const model = new ChatGoogleGenerativeAI({
      apiKey,
      model: modelName,
      apiVersion: 'v1',
      temperature,
      maxOutputTokens: maxTokens,
      maxRetries: 3,
    });

    // Prepare system instructions with JSON schema constraints if in structured mode
    let effectiveSystemInstructions = systemInstructions;
    if (structuredOutput) {
      effectiveSystemInstructions += `\n\nCRITICAL FORMAT REQUIREMENT:\nYou MUST respond ONLY with a single valid JSON object adhering to the schema below. Do NOT wrap with markdown, preambles, or conversational commentary.\nSchema:\n${outputSchema || '{}'}`;
    }

    // Prepare message history
    const messages = [new SystemMessage(effectiveSystemInstructions)];

    // Inject conversation memory if enabled
    const memoryKey = executionId || context.executionId || 'default';
    if (enableMemory && executionMemoryStore.has(memoryKey)) {
      const priorMessages = executionMemoryStore.get(memoryKey);
      messages.push(...priorMessages);
    }

    messages.push(new HumanMessage(promptText));

    const tools = getToolsForAgent(enabledTools);
    let rawOutputText = '';
    const executedToolObservations = [];
    let tokenUsage = null;

    if (tools.length > 0) {
      log(`[AI Agent] Activating ReAct agent loop with ${tools.length} active tool(s)...`);
      const agentApp = createReactAgent({
        llm: model,
        tools,
      });

      const finalState = await agentApp.invoke({ messages }, { signal: controller.signal });
      const finalMessages = finalState.messages || [];

      for (const msg of finalMessages) {
        if (msg instanceof AIMessage && msg.tool_calls && msg.tool_calls.length > 0) {
          for (const tc of msg.tool_calls) {
            log(`[AI Agent Action] Tool Call: ${tc.name}(${JSON.stringify(tc.args)})`);
            executedToolObservations.push({ tool: tc.name, args: tc.args });
          }
        } else if (msg instanceof ToolMessage) {
          log(`[AI Agent Observation] ${msg.name} -> ${String(msg.content).slice(0, 100)}...`);
        }
      }

      const lastMessage = finalMessages[finalMessages.length - 1];
      rawOutputText = lastMessage?.content || '';
      tokenUsage = lastMessage?.response_metadata?.tokenUsage || lastMessage?.usage_metadata;
    } else {
      // Pure Gemini inference without tools (Fast and high throughput)
      log(`[AI Agent] Invoking Gemini model for general-purpose inference...`);
      const response = await model.invoke(messages, { signal: controller.signal });
      rawOutputText = response?.content || '';
      tokenUsage = response?.response_metadata?.tokenUsage || response?.usage_metadata;
    }

    clearTimeout(timeoutId);

    // Save memory if enabled
    if (enableMemory) {
      const currentHistory = executionMemoryStore.get(memoryKey) || [];
      currentHistory.push(new HumanMessage(promptText));
      currentHistory.push(new AIMessage(rawOutputText));
      executionMemoryStore.set(memoryKey, currentHistory.slice(-10)); // Keep last 10 turns
    }

    log(`[AI Agent] Gemini response generated successfully (${rawOutputText.length} characters). Normalizing output...`);

    return normalizeAgentOutput({
      rawText: rawOutputText,
      structuredOutput,
      outputSchema,
      model: modelName,
      usage: tokenUsage
        ? {
          inputTokens: tokenUsage.promptTokens || tokenUsage.inputTokens || 0,
          outputTokens: tokenUsage.completionTokens || tokenUsage.outputTokens || 0,
        }
        : null,
      toolsUsed: tools.map((t) => t.name),
      toolExecutions: executedToolObservations,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError' || err.message?.includes('timeout') || err.message?.includes('aborted')) {
      log(`[AI Agent Error] Gemini request timed out after ${timeoutMs}ms`, 'ERROR');
      throw new Error(`AI Agent error: Google Gemini request timed out after ${timeoutMs}ms`);
    }

    if (err.status === 429 || err.message?.includes('429') || err.message?.toLowerCase().includes('rate limit')) {
      log(`[AI Agent Error] Google Gemini Rate Limit Exceeded (429)`, 'ERROR');
      throw new Error('AI Agent error: Google Gemini rate limit exceeded (429). Please retry shortly.');
    }

    if (err.status === 401 || err.status === 403 || err.message?.includes('401') || err.message?.includes('API_KEY_INVALID') || err.message?.toLowerCase().includes('unauthorized')) {
      log(`[AI Agent Error] Google Gemini API Key Invalid or Unauthorized`, 'ERROR');
      throw new Error('AI Agent error: Invalid API key or unauthorized access to Google Gemini. Check your GEMINI_API_KEY in server/.env.');
    }

    if (
      err.status === 404 ||
      err.message?.includes('404') ||
      err.message?.includes('not found for API version') ||
      err.message?.includes('is not found')
    ) {
      log(`[AI Agent Error] Gemini Model Not Found or Invalid API Key (404)`, 'ERROR');
      throw new Error(
        'AI Agent error: Google Gemini returned 404 Not Found. This happens when the API key is not an official Google AI Studio key, or does not have access to the model. Generate a free API key at https://aistudio.google.com/app/apikey (keys start with "AIzaSy...").'
      );
    }

    log(`[AI Agent Error] Gemini provider error: ${err.message}`, 'ERROR');
    throw err;
  }
}
