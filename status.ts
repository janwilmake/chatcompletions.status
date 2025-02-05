import providersJson from "./providers.json";

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
      Object.values(providersJson.providers).map(
        async ({ statusUrl, statusId, statusName, id }: any) => {
          try {
            const resp = await fetch(statusUrl, {
              headers: { Accept: "application/json" },
            });

            if (!resp.ok) {
              statuses[id] = false;
              return;
            }

            const data: { components: any[]; status: any } = await resp.json();
            const component = statusId
              ? data.components?.find((c: any) => c.id === statusId)
              : statusName
              ? data.components?.find((c: any) =>
                  c.name.toLowerCase().includes(statusName.toLowerCase()),
                )
              : false;

            if (component) {
              // Find specific component by ID
              statuses[id] = component?.status === "operational";
            } else {
              // Default to overall status
              statuses[id] = data.status?.indicator === "none";
            }
          } catch (error) {
            console.error(`Error checking ${id}:`, error);
            statuses[id] = false;
          }
        },
      ),
    );

    const responseData = {
      updated: new Date().toISOString(),
      services: statuses,
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
