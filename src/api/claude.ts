import type { Recipe, BatchPlan, PrepDayPlan } from '../types/recipe'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-3-haiku'

const SYSTEM_PROMPT = `You are a batch cooking planner. Collapse 2-5 recipes into one efficient production-line session.

Rules:
- Batch ALL prep before cooking. Combine shared ingredients across recipes.
- Container labels: A = 1st recipe, B = 2nd, etc.
- Mark divergence points where recipes split.
- Keep ALL descriptions under 15 words each.
- Shopping list: group by category, combine quantities.

CRITICAL: Your response MUST be complete, valid JSON. Do NOT write long descriptions. Be extremely concise.

Return ONLY this JSON structure:
{"prepPhase":[{"task":"short task","distribute":[{"container":"A - Name","amount":"2 onions"}]}],"cookingPhase":[{"step":1,"task":"short step","containers":["A","B"],"splitAfter":false}],"shoppingList":[{"ingredient":"onion","totalAmount":"4","usedIn":["Recipe A"],"category":"Produce"}],"estimatedTotalTime":75}

Valid categories: Produce, Meat & Fish, Dairy & Eggs, Tins & Jars, Pantry, Spices & Seasonings, Other`

function buildUserPrompt(recipes: Recipe[]): string {
  const labels = 'ABCDE'
  const compact = recipes.map((r, i) => ({
    id: labels[i],
    name: r.name,
    servings: r.servings,
    ingredients: r.ingredientGroups.flatMap(g =>
      g.ingredients.map(ing => `${ing.quantity ?? ''}${ing.unit ? ' ' + ing.unit : ''} ${ing.item}`.trim())
    ),
  }))

  return `Batch plan for ${recipes.length} recipes (already scaled). Be VERY concise — max 15 words per task.

${JSON.stringify(compact)}

Return ONLY valid JSON. No markdown. No explanation.`
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/gm, '')
    .replace(/\n?```\s*$/gm, '')
    .trim()
}

function validatePlan(obj: unknown): obj is BatchPlan {
  if (!obj || typeof obj !== 'object') return false
  const plan = obj as Record<string, unknown>
  return (
    Array.isArray(plan.prepPhase) &&
    Array.isArray(plan.cookingPhase) &&
    Array.isArray(plan.shoppingList) &&
    typeof plan.estimatedTotalTime === 'number'
  )
}

interface ApiResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[]
}

async function doRequest(
  apiKey: string,
  msgs: { role: string; content: string }[],
  maxTokens: number,
): Promise<{ content: string; truncated: boolean }> {
  let res: Response
  try {
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'MealPlan',
      },
      body: JSON.stringify({ model: MODEL, messages: msgs, temperature: 0.3, max_tokens: maxTokens }),
    })
  } catch (networkErr) {
    throw new Error(`Network error: ${networkErr instanceof Error ? networkErr.message : 'Failed to reach OpenRouter'}`)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '(could not read body)')
    throw new Error(`OpenRouter API error ${res.status}: ${body}`)
  }

  const data: ApiResponse = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error(`Empty response from API. Response: ${JSON.stringify(data).slice(0, 300)}`)
  }
  const truncated = data.choices?.[0]?.finish_reason === 'length'
  return { content, truncated }
}

function parseAndValidate<T>(
  raw: string,
  validator: (obj: unknown) => obj is T,
  truncated: boolean,
): T {
  const cleaned = stripMarkdownFences(raw)
  if (truncated) {
    throw new Error('Response was truncated (too long). Retrying with shorter output...')
  }
  const parsed = JSON.parse(cleaned)
  if (!validator(parsed)) {
    throw new Error('Response missing required fields')
  }
  return parsed
}

export async function generateBatchPlan(recipes: Recipe[]): Promise<BatchPlan> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OpenRouter API key not configured. Set VITE_OPENROUTER_API_KEY in .env')

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(recipes) },
  ]

  const { content: raw, truncated } = await doRequest(apiKey, messages, 4096)

  try {
    return parseAndValidate(raw, validatePlan, truncated)
  } catch (firstError) {
    const retryMessages = [
      ...messages,
      { role: 'assistant', content: raw },
      {
        role: 'user',
        content: `That response ${truncated ? 'was truncated — it was too long' : 'had invalid JSON'}. This time:
- Keep prep tasks to max 8 items (combine similar ones)
- Keep cooking steps to max 10
- Shopping list: max 20 items, combine similar
- Each description: max 10 words
- Return ONLY complete valid JSON, no other text`,
      },
    ]

    const { content: raw2, truncated: trunc2 } = await doRequest(apiKey, retryMessages, 4096)
    return parseAndValidate(raw2, validatePlan, trunc2)
  }
}

// --- Prep Day ---

const PREP_DAY_SYSTEM_PROMPT = `You are a meal prep advisor with food safety expertise. Identify what can be safely prepared 1-3 days before a cook day.

FOOD SAFETY LIMITS (non-negotiable):
- Firm veg (peppers, onions, carrots, celery, broccoli): max 5 days fridge
- Soft veg (tomato, cucumber, courgette, mushroom): max 3 days fridge
- Garlic in oil: max 4 days fridge (botulism risk — add safetyNote)
- Fresh herbs chopped: max 2 days fridge
- Marinated raw meat/poultry: max 2 days fridge
- Raw fish: max 1 day fridge (always add safetyNote)
- Pre-cooked stews/curries: max 3 days fridge
- Dry spices/pantry: no limit
- NEVER prep: avocado, cracked eggs, cooked rice

CRITICAL: Keep ALL descriptions under 12 words. Response MUST be complete valid JSON.

Return ONLY this JSON:
{"recommendedDaysInAdvance":2,"tasks":[{"task":"short task","category":"vegetable_prep","storage":"airtight container, fridge","maxStorageDays":5,"safetyNote":null,"distribute":[{"container":"A - Name","amount":"1 pepper"}]}],"notRecommended":[{"item":"avocado","reason":"Oxidises rapidly"}],"safetyDisclaimer":"Storage times assume ≤4°C in airtight containers. Based on FSA/USDA guidelines."}

Valid categories: vegetable_prep, meat_prep, marinating, measuring, full_cook`

function buildPrepDayUserPrompt(recipes: Recipe[]): string {
  const labels = 'ABCDE'
  const compact = recipes.map((r, i) => ({
    id: labels[i],
    name: r.name,
    servings: r.servings,
    slowCook: r.cookMins >= 90,
    ingredients: r.ingredientGroups.flatMap(g =>
      g.ingredients.map(ing => `${ing.quantity ?? ''}${ing.unit ? ' ' + ing.unit : ''} ${ing.item}`.trim())
    ),
  }))

  return `Prep day plan for ${recipes.length} recipes. Be VERY concise — max 12 words per task.

${JSON.stringify(compact)}

Return ONLY valid JSON. No markdown. No explanation.`
}

function validatePrepDayPlan(obj: unknown): obj is PrepDayPlan {
  if (!obj || typeof obj !== 'object') return false
  const plan = obj as Record<string, unknown>
  return (
    typeof plan.recommendedDaysInAdvance === 'number' &&
    Array.isArray(plan.tasks) &&
    Array.isArray(plan.notRecommended) &&
    typeof plan.safetyDisclaimer === 'string'
  )
}

export async function generatePrepDayPlan(recipes: Recipe[]): Promise<PrepDayPlan> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
  if (!apiKey) throw new Error('OpenRouter API key not configured. Set VITE_OPENROUTER_API_KEY in .env')

  const messages = [
    { role: 'system', content: PREP_DAY_SYSTEM_PROMPT },
    { role: 'user', content: buildPrepDayUserPrompt(recipes) },
  ]

  const { content: raw, truncated } = await doRequest(apiKey, messages, 4096)

  try {
    return parseAndValidate(raw, validatePrepDayPlan, truncated)
  } catch (firstError) {
    const retryMessages = [
      ...messages,
      { role: 'assistant', content: raw },
      {
        role: 'user',
        content: `That response ${truncated ? 'was truncated' : 'had invalid JSON'}. Be shorter:
- Max 10 tasks, max 5 notRecommended items
- Max 12 words per description
- Return ONLY complete valid JSON`,
      },
    ]

    const { content: raw2, truncated: trunc2 } = await doRequest(apiKey, retryMessages, 4096)
    return parseAndValidate(raw2, validatePrepDayPlan, trunc2)
  }
}
