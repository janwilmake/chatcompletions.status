import AI_STATUS_PAGES from "./status-pages.json";

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    console.log("REQUEST STATUS");
    const cache = caches.default;
    const cacheKey = new Request("https://api-status.internal/status");

    // Try to get from cache first
    let response = await cache.match(cacheKey);
    if (response) {
      return response;
    }

    // Fetch fresh data
    const statuses: Record<string, boolean> = {};

    await Promise.all(
      AI_STATUS_PAGES.map(async ({ domain, componentId, apiString }) => {
        try {
          const resp = await fetch(`https://${domain}`, {
            headers: { Accept: "application/json" },
          });

          if (!resp.ok) {
            statuses[domain] = false;
            return;
          }

          const data: { components: any[]; status: any } = await resp.json();
          const component = componentId
            ? data.components?.find((c: any) => c.id === componentId)
            : apiString
            ? data.components?.find((c: any) =>
                c.name.toLowerCase().includes(apiString.toLowerCase()),
              )
            : false;

          if (component) {
            // Find specific component by ID
            statuses[domain] = component?.status === "operational";
          } else {
            // Default to overall status
            statuses[domain] = data.status?.indicator === "none";
          }
        } catch (error) {
          console.error(`Error checking ${domain}:`, error);
          statuses[domain] = false;
        }
      }),
    );

    const responseData = {
      updated: new Date().toISOString(),
      services: {
        openai: statuses["status.openai.com"],
        anthropic: statuses["status.anthropic.com"],
        deepseek: statuses["status.deepseek.com"],
        groq: statuses["groqstatus.com"],
      },
    };

    response = new Response(JSON.stringify(responseData, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=8640000",
      },
    });

    // Cache for 1 minute, allow serving stale for up to 5 minutes while revalidating
    ctx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  },
};
