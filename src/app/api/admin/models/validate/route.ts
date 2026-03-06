import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { getProviderByValue } from "@/lib/constants/providers";

interface ProviderModel {
  id: string;
  name: string;
}

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin(request);
    if (!gate.ok) return gate.response;

    const { provider, api_key } = await request.json();

    if (!provider || !api_key) {
      return NextResponse.json(
        { error: "provider and api_key are required" },
        { status: 400 },
      );
    }

    const providerConfig = getProviderByValue(provider);
    if (!providerConfig) {
      return NextResponse.json(
        { error: `Unknown provider: ${provider}` },
        { status: 400 },
      );
    }

    const models = await fetchModels(providerConfig, api_key.trim());

    return NextResponse.json({
      valid: true,
      models,
      count: models.length,
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    const status = err.status || 500;
    const message = err.message || "Failed to validate API key";
    console.error("Admin models validate error:", message);
    return NextResponse.json({ error: message, valid: false }, { status });
  }
}

async function fetchModels(
  providerConfig: NonNullable<ReturnType<typeof getProviderByValue>>,
  apiKey: string,
): Promise<ProviderModel[]> {
  const { value, defaultEndpoint, authStyle } = providerConfig;

  switch (value) {
    case "openai":
    case "openrouter":
      return fetchOpenAICompatible(defaultEndpoint, apiKey);
    case "anthropic":
      return fetchAnthropic(defaultEndpoint, apiKey, providerConfig);
    case "google":
      return fetchGoogle(defaultEndpoint, apiKey);
    default:
      throw createError(400, `Unsupported provider: ${value}`);
  }
}

async function fetchOpenAICompatible(
  endpoint: string,
  apiKey: string,
): Promise<ProviderModel[]> {
  const res = await fetchWithTimeout(`${endpoint}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  handleHttpError(res);
  const json = await res.json();
  const models: Array<{ id: string }> = json.data || [];

  return models
    .map((m) => ({ id: m.id, name: m.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchAnthropic(
  endpoint: string,
  apiKey: string,
  config: NonNullable<ReturnType<typeof getProviderByValue>>,
): Promise<ProviderModel[]> {
  const extraHeaders =
    "extraHeaders" in config
      ? (config.extraHeaders as Record<string, string>)
      : {};
  const authHeader =
    "authHeader" in config ? (config.authHeader as string) : "x-api-key";

  const allModels: ProviderModel[] = [];
  let hasMore = true;
  let afterId: string | undefined;

  while (hasMore) {
    const url = new URL(`${endpoint}/models`);
    url.searchParams.set("limit", "100");
    if (afterId) url.searchParams.set("after_id", afterId);

    const res = await fetchWithTimeout(url.toString(), {
      headers: {
        [authHeader]: apiKey,
        ...extraHeaders,
      },
    });

    handleHttpError(res);
    const json = await res.json();
    const models: Array<{ id: string; display_name?: string }> =
      json.data || [];

    for (const m of models) {
      allModels.push({
        id: m.id,
        name: m.display_name || m.id,
      });
    }

    hasMore = json.has_more === true;
    if (hasMore && models.length > 0) {
      afterId = models[models.length - 1].id;
    } else {
      hasMore = false;
    }
  }

  return allModels.sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchGoogle(
  endpoint: string,
  apiKey: string,
): Promise<ProviderModel[]> {
  const res = await fetchWithTimeout(`${endpoint}/models?key=${apiKey}`, {});

  handleHttpError(res);
  const json = await res.json();
  const models: Array<{ name: string; displayName?: string }> =
    json.models || [];

  return models
    .map((m) => {
      const id = m.name.replace(/^models\//, "");
      return { id, name: m.displayName || id };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function createError(status: number, message: string) {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

function handleHttpError(res: Response) {
  if (res.ok) return;

  if (res.status === 401 || res.status === 403) {
    throw createError(401, "Invalid API key");
  }
  if (res.status === 429) {
    throw createError(429, "Rate limited — please try again in a moment");
  }
  throw createError(res.status, `Provider returned ${res.status}`);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw createError(504, "Provider request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
