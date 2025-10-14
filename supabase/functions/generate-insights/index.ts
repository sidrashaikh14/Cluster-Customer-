import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin || "http://localhost:5173",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Credentials": "true",
});

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    const { segments, metrics, trends, type = "detailed" } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    console.log("openai key", OPENAI_API_KEY);
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const systemPrompt = type === "summary"
      ? `You are a customer analytics expert. Provide a concise executive summary (max 300 words) of customer segmentation data.

FORMATTING:
- Use numbered lists (1., 2., 3.) for sequential items
- Use bullet points (•) for key items
- NO asterisks (*) or hashtags (#)
- Section headers in UPPERCASE with colon

STRUCTURE:
1. KEY INSIGHTS: Top 3 critical findings
2. RECOMMENDATION: One actionable step`
      : `You are a customer analytics consultant. Provide a focused analysis (max 600 words) of customer segmentation data.

FORMATTING:
- Numbered lists (1., 2., 3.) for recommendations
- Bullet points (•) for findings
- NO asterisks (*) or hashtags (#)
- UPPERCASE section headers with colon

SECTIONS:
1. EXECUTIVE SUMMARY: High-level overview (2 paragraphs)
2. SEGMENT ANALYSIS:
   • Top 3 segments with characteristics and value
   • Key behavioral patterns
3. OPPORTUNITIES:
   Number each (1., 2., 3.) with:
   • Growth strategy
   • Estimated impact
   • Implementation difficulty
4. RECOMMENDATIONS:
   Top 3 prioritized actions (1., 2., 3.) with expected ROI and timeline

Use specific numbers from the data.`;

    const userPrompt = `Analyze this customer analytics data:

CUSTOMER SEGMENTS:
${segments.map((s: any) => `- ${s.name}: ${s.value} customers (${s.percentage}% of total)`).join('\n')}

KEY METRICS:
- Total Customer Base: ${metrics.totalCustomers.toLocaleString()}
- Total Revenue: $${metrics.totalRevenue.toLocaleString()}
- Average Order Value: $${Math.round(metrics.avgOrderValue).toLocaleString()}
- Largest Segment: ${metrics.topSegment}

MONTHLY PERFORMANCE TRENDS (Last 12 Months):
${trends.map((t: any) => `${t.month}: ${t.customers} customers, $${t.revenue.toLocaleString()} revenue`).join('\n')}

${type === "summary" ? "Provide a brief executive summary." : "Provide a comprehensive detailed report with specific recommendations for growth and retention strategies for each segment."}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // You can change to "gpt-4o" or "gpt-3.5-turbo"
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "OpenAI API error" }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const insights = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ insights }),
      { headers: { ...headers, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-insights error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } }
    );
  }
});
