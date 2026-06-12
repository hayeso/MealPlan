/**
 * Maps variant ingredient names to canonical forms.
 * Key = variant (lowercase), Value = canonical name.
 */
export const INGREDIENT_SYNONYMS: Record<string, string> = {
  'spring onion': 'spring onion',
  'spring onions': 'spring onion',
  'scallion': 'spring onion',
  'scallions': 'spring onion',
  'green onion': 'spring onion',
  'green onions': 'spring onion',

  'coriander': 'coriander',
  'cilantro': 'coriander',
  'fresh coriander': 'coriander',
  'fresh cilantro': 'coriander',

  'capsicum': 'bell pepper',
  'bell pepper': 'bell pepper',
  'red pepper': 'red bell pepper',
  'green pepper': 'green bell pepper',

  'aubergine': 'aubergine',
  'eggplant': 'aubergine',

  'courgette': 'courgette',
  'zucchini': 'courgette',

  'prawns': 'prawns',
  'shrimp': 'prawns',
  'king prawns': 'prawns',

  'plain flour': 'plain flour',
  'all-purpose flour': 'plain flour',
  'all purpose flour': 'plain flour',

  'caster sugar': 'caster sugar',
  'superfine sugar': 'caster sugar',

  'icing sugar': 'icing sugar',
  'powdered sugar': 'icing sugar',
  'confectioners sugar': 'icing sugar',

  'double cream': 'double cream',
  'heavy cream': 'double cream',
  'heavy whipping cream': 'double cream',

  'single cream': 'single cream',
  'light cream': 'single cream',

  'natural yoghurt': 'natural yoghurt',
  'plain yogurt': 'natural yoghurt',
  'natural yogurt': 'natural yoghurt',
  'greek yoghurt': 'greek yoghurt',
  'greek yogurt': 'greek yoghurt',

  'tinned tomatoes': 'tinned tomatoes',
  'canned tomatoes': 'tinned tomatoes',
  'chopped tomatoes': 'tinned tomatoes',

  'tomato puree': 'tomato puree',
  'tomato paste': 'tomato puree',

  'rapeseed oil': 'rapeseed oil',
  'canola oil': 'rapeseed oil',

  'groundnut oil': 'groundnut oil',
  'peanut oil': 'groundnut oil',

  'bicarbonate of soda': 'bicarbonate of soda',
  'baking soda': 'bicarbonate of soda',

  'rocket': 'rocket',
  'arugula': 'rocket',

  'mange tout': 'mange tout',
  'sugar snap peas': 'mange tout',
  'snow peas': 'mange tout',

  'streaky bacon': 'streaky bacon',
  'bacon rashers': 'streaky bacon',

  'mince': 'minced beef',
  'ground beef': 'minced beef',
  'beef mince': 'minced beef',

  'chicken stock': 'chicken stock',
  'chicken broth': 'chicken stock',

  'vegetable stock': 'vegetable stock',
  'vegetable broth': 'vegetable stock',

  'beef stock': 'beef stock',
  'beef broth': 'beef stock',

  'soured cream': 'soured cream',
  'sour cream': 'soured cream',
}

export const SHOPPING_CATEGORIES: Record<string, string[]> = {
  'Produce': [
    'onion', 'garlic', 'ginger', 'tomato', 'potato', 'carrot', 'celery',
    'pepper', 'chilli', 'lemon', 'lime', 'avocado', 'lettuce', 'spinach',
    'cabbage', 'broccoli', 'cauliflower', 'mushroom', 'courgette', 'aubergine',
    'cucumber', 'radish', 'spring onion', 'coriander', 'parsley', 'mint',
    'basil', 'thyme', 'rosemary', 'dill', 'rocket', 'kale', 'pak choi',
    'bean sprout', 'mange tout', 'corn', 'sweet potato', 'butternut',
  ],
  'Meat & Fish': [
    'chicken', 'beef', 'pork', 'lamb', 'mince', 'bacon', 'sausage', 'chorizo',
    'pancetta', 'prosciutto', 'ham', 'fish', 'cod', 'salmon', 'tuna', 'prawns',
    'shrimp', 'squid', 'mackerel', 'halibut', 'haddock', 'pollock', 'lobster',
    'scallop', 'steak', 'brisket', 'rib',
  ],
  'Dairy & Eggs': [
    'milk', 'cream', 'butter', 'cheese', 'yoghurt', 'yogurt', 'egg',
    'parmesan', 'mozzarella', 'cheddar', 'feta', 'halloumi', 'mascarpone',
    'crème fraîche', 'creme fraiche', 'soured cream', 'sour cream',
  ],
  'Tins & Jars': [
    'tinned', 'canned', 'coconut milk', 'coconut cream', 'passata',
    'tomato puree', 'tomato paste', 'beans', 'chickpeas', 'lentils',
    'olives', 'capers', 'anchovies', 'pesto', 'harissa',
  ],
  'Pantry': [
    'flour', 'sugar', 'rice', 'pasta', 'noodle', 'bread', 'tortilla',
    'wrap', 'couscous', 'quinoa', 'oats', 'granola', 'cereal',
    'oil', 'vinegar', 'soy sauce', 'fish sauce', 'worcestershire',
    'mustard', 'ketchup', 'mayo', 'honey', 'maple syrup',
    'stock', 'broth', 'bouillon',
  ],
  'Spices & Seasonings': [
    'salt', 'pepper', 'cumin', 'coriander', 'turmeric', 'paprika',
    'cinnamon', 'nutmeg', 'chilli powder', 'cayenne', 'oregano',
    'garam masala', 'curry powder', 'five spice', 'za\'atar', 'sumac',
    'bay leaf', 'star anise', 'cardamom', 'clove', 'fennel seed',
  ],
}

export function normaliseIngredientName(item: string): string {
  const lower = item.toLowerCase().trim()
  if (INGREDIENT_SYNONYMS[lower]) return INGREDIENT_SYNONYMS[lower]

  const singular = lower
    .replace(/ies$/, 'y')
    .replace(/oes$/, 'o')
    .replace(/ses$/, 'se')
    .replace(/s$/, '')
  if (INGREDIENT_SYNONYMS[singular]) return INGREDIENT_SYNONYMS[singular]

  return lower
}

export function categoriseIngredient(item: string): string {
  const lower = item.toLowerCase()
  for (const [category, keywords] of Object.entries(SHOPPING_CATEGORIES)) {
    if (keywords.some(kw => lower.includes(kw))) return category
  }
  return 'Other'
}
