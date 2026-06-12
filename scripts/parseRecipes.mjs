import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { load } from 'cheerio'

const HTML_PATH = process.argv[2] || '../recipes (3).html'
const OUT_PATH = process.argv[3] || '../public/recipes.json'

const html = readFileSync(HTML_PATH, 'utf-8')
const $ = load(html)

function parseISO8601(iso) {
  if (!iso || iso === 'PT0S') return 0
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  return (parseInt(match[1] || '0') * 60) +
         parseInt(match[2] || '0') +
         (parseInt(match[3] || '0') > 0 ? 1 : 0)
}

function parseYield(raw) {
  if (!raw) return 4
  const match = raw.match(/(\d+)/)
  return match ? parseInt(match[1]) : 4
}

const UNIT_PATTERN = /^(tablespoons?|tbsp|teaspoons?|tsp|cups?|g|kg|ml|l|litres?|liters?|oz|ounces?|lbs?|pounds?|pinch(?:es)?|bunch(?:es)?|handful|cloves?|sprigs?|slices?|pieces?|heads?|cans?|tins?|packets?|rashers?|fillets?|stalks?|sticks?|sheets?|cm|inch(?:es)?)$/i

const TRAILING_PREP = /,\s*(?:finely |roughly |thinly |freshly )?(?:diced|sliced|chopped|minced|grated|crushed|peeled|seeded|deseeded|halved|quartered|trimmed|torn|shredded|julienned|cubed|cut into .*|broken into .*)/i
const LEADING_PREP = /^(?:finely |roughly |thinly |freshly )?(?:diced|sliced|chopped|minced|grated|crushed)\s+/i

function isGroupHeader(text) {
  const trimmed = text.trim()
  if (trimmed.length < 3) return false
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) return true
  if (/^(?:FOR THE |TO SERVE|TO ASSEMBLE|TO MAKE)/i.test(trimmed) && trimmed === trimmed.toUpperCase()) return true
  return false
}

function parseIngredientLine(raw) {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const result = { raw: trimmed, quantity: null, unit: null, item: trimmed, prep: null, notes: null }

  // Match leading quantity: "2", "1/2", "1½", "1.5", "½", "¼", "¾", "⅓"
  const qtyMatch = trimmed.match(/^([\d]+[\d\/\.\s½¼¾⅓⅔⅛]*(?:[\/-][\d\/½¼¾⅓⅔⅛]+)?)\s*(.*)$/)

  if (!qtyMatch) {
    const prepMatch = trimmed.match(TRAILING_PREP)
    if (prepMatch) {
      result.item = trimmed.slice(0, prepMatch.index).trim()
      result.prep = prepMatch[0].replace(/^,\s*/, '').trim()
    }
    return result
  }

  let qtyStr = qtyMatch[1].trim()
  let remainder = qtyMatch[2].trim()

  // Convert unicode fractions
  qtyStr = qtyStr.replace('½', '.5').replace('¼', '.25').replace('¾', '.75')
    .replace('⅓', '.333').replace('⅔', '.667').replace('⅛', '.125')

  // Handle "1 1/2" style
  const mixedMatch = qtyStr.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixedMatch) {
    result.quantity = parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3])
  } else if (qtyStr.includes('/')) {
    const [num, den] = qtyStr.split('/')
    result.quantity = parseFloat(num) / parseFloat(den)
  } else {
    result.quantity = parseFloat(qtyStr)
  }

  if (isNaN(result.quantity)) {
    result.quantity = null
    result.item = trimmed
    return result
  }

  // Try to extract unit
  const words = remainder.split(/\s+/)
  if (words.length > 0 && UNIT_PATTERN.test(words[0])) {
    result.unit = words[0].toLowerCase()
    remainder = words.slice(1).join(' ')
  }

  // Strip "of " prefix
  remainder = remainder.replace(/^of\s+/i, '')

  // Check for leading prep ("minced fresh ginger" → prep: "minced", item: "fresh ginger")
  const leadMatch = remainder.match(LEADING_PREP)
  if (leadMatch) {
    result.prep = leadMatch[0].trim()
    remainder = remainder.slice(leadMatch[0].length)
  }

  // Check for trailing prep after comma ("red cabbage, thinly sliced")
  const trailMatch = remainder.match(TRAILING_PREP)
  if (trailMatch) {
    result.item = remainder.slice(0, trailMatch.index).trim()
    const trailPrep = trailMatch[0].replace(/^,\s*/, '').trim()
    result.prep = result.prep ? `${result.prep}, ${trailPrep}` : trailPrep
  } else {
    // Check for parenthetical notes
    const parenMatch = remainder.match(/\(([^)]+)\)/)
    if (parenMatch) {
      result.notes = parenMatch[1]
      result.item = remainder.replace(/\s*\([^)]+\)\s*/g, ' ').trim()
    } else {
      result.item = remainder.trim()
    }
  }

  // Clean trailing commas from item
  result.item = result.item.replace(/,\s*$/, '').trim()

  return result
}

const PROTEIN_KEYWORDS = {
  chicken: ['chicken', 'poultry'],
  beef: ['beef', 'steak', 'brisket', 'mince'],
  pork: ['pork', 'bacon', 'chorizo', 'sausage', 'ham', 'pancetta', 'prosciutto'],
  lamb: ['lamb'],
  fish: ['fish', 'cod', 'salmon', 'tuna', 'halibut', 'pollock', 'haddock', 'prawns', 'shrimp', 'squid', 'anchov'],
  vegetarian: ['tofu', 'tempeh', 'paneer', 'halloumi'],
  eggs: ['eggs', 'egg'],
}

const CUISINE_KEYWORDS = {
  asian: ['soy sauce', 'sesame', 'ginger', 'rice vinegar', 'miso', 'noodle', 'wok', 'teriyaki', 'hoisin'],
  thai: ['thai', 'coconut milk', 'lemongrass', 'fish sauce', 'pad', 'curry paste'],
  indian: ['curry', 'masala', 'garam', 'turmeric', 'cumin', 'tikka', 'naan', 'chutney', 'madras', 'korma', 'biryani'],
  italian: ['pasta', 'risotto', 'parmesan', 'mozzarella', 'basil', 'oregano', 'italian', 'bolognese', 'carbonara', 'pesto'],
  mexican: ['tortilla', 'taco', 'salsa', 'jalapeño', 'jalapeno', 'chipotle', 'burrito', 'quesadilla', 'guacamole', 'mexican'],
  mediterranean: ['feta', 'olive', 'hummus', 'tahini', 'za\'atar', 'sumac', 'harissa', 'mediterranean'],
  korean: ['gochujang', 'kimchi', 'korean', 'bulgogi', 'bibimbap'],
  middle_eastern: ['sumac', 'za\'atar', 'pomegranate', 'shawarma', 'falafel', 'middle eastern'],
}

function autoTag(name, ingredientTexts) {
  const searchText = (name + ' ' + ingredientTexts.join(' ')).toLowerCase()
  const tags = []

  for (const [protein, keywords] of Object.entries(PROTEIN_KEYWORDS)) {
    if (keywords.some(kw => searchText.includes(kw))) {
      tags.push(protein)
    }
  }

  for (const [cuisine, keywords] of Object.entries(CUISINE_KEYWORDS)) {
    if (keywords.some(kw => searchText.includes(kw))) {
      tags.push(cuisine)
    }
  }

  return [...new Set(tags)]
}

const recipes = []

$('div.recipe-details').each((_, el) => {
  const $el = $(el)

  const id = $el.find('[itemprop="recipeId"]').attr('content') || ''
  const name = $el.find('[itemprop="name"]').text().trim()
  const course = $el.find('[itemprop="recipeCourse"]').text().trim() || 'Main Dish'
  const servings = parseYield($el.find('[itemprop="recipeYield"]').text().trim())
  const prepTime = $el.find('[itemprop="prepTime"]').attr('content') || 'PT0S'
  const cookTime = $el.find('[itemprop="cookTime"]').attr('content') || 'PT0S'
  const prepMins = parseISO8601(prepTime)
  const cookMins = parseISO8601(cookTime)

  // Parse ingredients
  const ingredientGroups = []
  let currentGroup = { groupName: null, ingredients: [] }
  const allIngredientTexts = []

  $el.find('[itemprop="recipeIngredients"] p').each((_, pEl) => {
    const text = $(pEl).text().trim()

    if (!text) {
      // Empty line — potential group separator. Save current group if it has ingredients.
      if (currentGroup.ingredients.length > 0) {
        ingredientGroups.push(currentGroup)
        currentGroup = { groupName: null, ingredients: [] }
      }
      return
    }

    if (isGroupHeader(text)) {
      if (currentGroup.ingredients.length > 0) {
        ingredientGroups.push(currentGroup)
      }
      currentGroup = { groupName: text, ingredients: [] }
      return
    }

    const parsed = parseIngredientLine(text)
    if (parsed) {
      currentGroup.ingredients.push(parsed)
      allIngredientTexts.push(text)
    }
  })

  if (currentGroup.ingredients.length > 0) {
    ingredientGroups.push(currentGroup)
  }

  // If we ended up with only empty-named groups, merge them
  if (ingredientGroups.length === 0) {
    ingredientGroups.push({ groupName: null, ingredients: [] })
  }

  // Parse directions
  const directions = []
  $el.find('[itemprop="recipeDirections"] p').each((_, pEl) => {
    const text = $(pEl).text().trim()
    if (text) {
      directions.push(text)
    }
  })

  const tags = autoTag(name, allIngredientTexts)

  recipes.push({
    id,
    name: name.replace(/\s+/g, ' '),
    course,
    servings,
    prepMins,
    cookMins,
    totalMins: prepMins + cookMins,
    ingredientGroups,
    directions,
    tags,
  })
})

mkdirSync(new URL('../public', import.meta.url), { recursive: true })
writeFileSync(OUT_PATH, JSON.stringify(recipes, null, 2), 'utf-8')

console.log(`Parsed ${recipes.length} recipes → ${OUT_PATH}`)

// Summary
const courses = {}
recipes.forEach(r => { courses[r.course] = (courses[r.course] || 0) + 1 })
console.log('Courses:', courses)
console.log('Sample recipe:', JSON.stringify(recipes[0], null, 2).slice(0, 500))
