// A small built-in table of staple foods so search works offline and without a USDA key.
// Values are per 100 g, rounded from USDA reference data; they are approximations for
// typical items, not label values for any particular product.

import { type Food, withStandardServings } from './nutrition';

// name | kcal | protein | carbs | fat | fiber | sugar | sodium mg | sat fat | servings (label=grams;...)
const TABLE = `
Banana, raw|89|1.1|22.8|0.3|2.6|12.2|1|0.1|1 medium=118;1 large=136;1 cup sliced=150
Apple, raw, with skin|52|0.3|13.8|0.2|2.4|10.4|1|0|1 medium=182;1 small=149
Orange, raw|47|0.9|11.8|0.1|2.4|9.4|0|0|1 medium=131
Strawberries, raw|32|0.7|7.7|0.3|2|4.9|1|0|1 cup halves=152;1 medium=12
Blueberries, raw|57|0.7|14.5|0.3|2.4|10|1|0|1 cup=148
Raspberries, raw|52|1.2|11.9|0.7|6.5|4.4|1|0|1 cup=123
Grapes, raw|69|0.7|18.1|0.2|0.9|15.5|2|0.1|1 cup=151
Pear, raw|57|0.4|15.2|0.1|3.1|9.8|1|0|1 medium=178
Peach, raw|39|0.9|9.5|0.3|1.5|8.4|0|0|1 medium=150
Pineapple, raw|50|0.5|13.1|0.1|1.4|9.9|1|0|1 cup chunks=165
Mango, raw|60|0.8|15|0.4|1.6|13.7|1|0.1|1 cup pieces=165
Watermelon, raw|30|0.6|7.6|0.2|0.4|6.2|1|0|1 cup diced=152
Avocado, raw|160|2|8.5|14.7|6.7|0.7|7|2.1|1/2 avocado=75;1 avocado=150
Broccoli, raw|34|2.8|6.6|0.4|2.6|1.7|33|0|1 cup chopped=91
Spinach, raw|23|2.9|3.6|0.4|2.2|0.4|79|0.1|1 cup=30
Carrots, raw|41|0.9|9.6|0.2|2.8|4.7|69|0|1 medium=61;1 cup chopped=128
Tomato, raw|18|0.9|3.9|0.2|1.2|2.6|5|0|1 medium=123
Cucumber, raw|15|0.7|3.6|0.1|0.5|1.7|2|0|1 cup sliced=104
Bell pepper, red, raw|31|1|6|0.3|2.1|4.2|4|0|1 medium=119
Onion, raw|40|1.1|9.3|0.1|1.7|4.2|4|0|1 medium=110
Lettuce, romaine|17|1.2|3.3|0.3|2.1|1.2|8|0|1 cup shredded=47
Mushrooms, white, raw|22|3.1|3.3|0.3|1|2|5|0|1 cup sliced=70
Cauliflower, raw|25|1.9|5|0.3|2|1.9|30|0.1|1 cup chopped=107
Zucchini, raw|17|1.2|3.1|0.3|1|2.5|8|0.1|1 medium=196
Green beans, cooked|35|1.9|7.9|0.3|3.2|3.6|1|0.1|1 cup=125
Sweet corn, cooked|96|3.4|21|1.5|2.4|4.5|1|0.2|1 ear=103;1 cup kernels=149
Potato, baked, with skin|93|2.5|21.2|0.1|2.2|1.2|10|0|1 medium=173
Sweet potato, baked|90|2|20.7|0.2|3.3|6.5|36|0|1 medium=114
Chicken breast, cooked, skinless|165|31|0|3.6|0|0|74|1|3 oz=85;1 breast=172
Chicken thigh, cooked, skinless|209|26|0|10.9|0|0|88|3|3 oz=85
Ground beef, 85% lean, cooked|250|25.9|0|15.4|0|0|72|5.9|3 oz=85
Ground beef, 90% lean, cooked|217|26.1|0|11.7|0|0|68|4.7|3 oz=85
Pork loin, cooked|242|27.3|0|13.9|0|0|62|5.2|3 oz=85
Bacon, cooked|541|37|1.4|41.8|0|0|1717|13.7|1 slice=8
Salmon, Atlantic, cooked|206|22.1|0|12.4|0|0|61|2.5|3 oz=85;1 fillet=178
Tuna, light, canned in water|86|19.4|0|1|0|0|247|0.3|3 oz=85
Shrimp, cooked|99|24|0.2|0.3|0|0|111|0.1|3 oz=85
Egg, whole|143|12.6|0.7|9.5|0|0.4|142|3.1|1 large=50
Egg white|52|10.9|0.7|0.2|0|0.7|166|0|1 large white=33
Tofu, firm|144|17.3|2.8|8.7|2.3|0|14|1.3|1/2 cup=126
Black beans, cooked|132|8.9|23.7|0.5|8.7|0.3|1|0.1|1 cup=172
Chickpeas, cooked|164|8.9|27.4|2.6|7.6|4.8|7|0.3|1 cup=164
Lentils, cooked|116|9|20.1|0.4|7.9|1.8|2|0.1|1 cup=198
Milk, whole|61|3.2|4.8|3.3|0|5.1|43|1.9|1 cup=244
Milk, 2% fat|50|3.3|4.8|2|0|5.1|47|1.3|1 cup=244
Milk, skim|34|3.4|5|0.1|0|5.1|42|0.1|1 cup=245
Greek yogurt, plain, nonfat|59|10.2|3.6|0.4|0|3.2|36|0.1|1 container=170;1 cup=245
Yogurt, plain, whole milk|61|3.5|4.7|3.3|0|4.7|46|2.1|1 cup=245
Cheddar cheese|403|22.9|3.1|33.3|0|0.5|653|18.9|1 slice=28;1 cup shredded=113
Mozzarella, part skim|254|24.3|2.8|15.9|0|1.1|619|10.1|1 oz=28
Cottage cheese, 2% fat|81|10.4|4.8|2.3|0|4|308|1|1/2 cup=113
Cream cheese|350|6.2|5.5|34.4|0|3.8|314|20.2|1 tbsp=14.5
Butter, salted|717|0.9|0.1|81.1|0|0.1|643|51.4|1 tbsp=14.2;1 pat=5
White rice, cooked|130|2.7|28.2|0.3|0.4|0.1|1|0.1|1 cup=158
Brown rice, cooked|123|2.7|25.6|1|1.6|0.2|4|0.3|1 cup=202
Quinoa, cooked|120|4.4|21.3|1.9|2.8|0.9|7|0.2|1 cup=185
Pasta, cooked|158|5.8|30.9|0.9|1.8|0.6|1|0.2|1 cup=140
Rolled oats, dry|379|13.2|67.7|6.5|10.1|1|6|1.1|1/2 cup=40
Oatmeal, cooked with water|71|2.5|12|1.5|1.7|0.3|4|0.3|1 cup=234
Bread, whole wheat|252|12.5|42.7|3.5|6|4.3|455|0.7|1 slice=32
Bread, white|266|8.9|49.4|3.3|2.7|5.7|490|0.7|1 slice=28
Flour tortilla|304|8.2|49.4|7.7|3.5|3.7|736|2|1 medium (8 in)=49
Almonds|579|21.2|21.6|49.9|12.5|4.4|1|3.8|1 oz (about 23)=28.35
Walnuts|654|15.2|13.7|65.2|6.7|2.6|2|6.1|1 oz=28.35
Peanuts, dry roasted, unsalted|585|23.7|21.5|49.7|8|4.2|6|6.9|1 oz=28.35
Peanut butter, smooth|598|22.2|22.3|51.4|5|10.5|426|10.3|2 tbsp=32;1 tbsp=16
Chia seeds|486|16.5|42.1|30.7|34.4|0|16|3.3|1 tbsp=12
Olive oil|884|0|0|100|0|0|2|13.8|1 tbsp=13.5;1 tsp=4.5
Mayonnaise|680|1|0.6|74.9|0|0.6|635|11.7|1 tbsp=13.8
Hummus|166|7.9|14.3|9.6|6|0.3|379|1.4|2 tbsp=30
Ketchup|101|1|27.4|0.1|0.3|21.3|907|0|1 tbsp=17
Honey|304|0.3|82.4|0|0.2|82.1|4|0|1 tbsp=21
Sugar, granulated|387|0|100|0|0|99.8|1|0|1 tsp=4.2;1 tbsp=12.6
Dark chocolate, 70-85% cacao|598|7.8|45.9|42.6|10.9|24|20|24.5|1 oz=28.35
Popcorn, air-popped|387|12.9|77.8|4.5|14.5|0.9|8|0.6|1 cup=8
French fries|312|3.4|41.4|14.7|3.8|0.3|210|2.3|1 medium serving=117
Pizza, cheese|266|11.4|33.3|9.7|2.3|3.6|598|4.5|1 slice=107
Coffee, brewed, black|1|0.1|0|0|0|0|2|0|1 cup (8 fl oz)=237
Orange juice|45|0.7|10.4|0.2|0.2|8.4|1|0|1 cup=248
Beer, regular|43|0.5|3.6|0|0|0|4|0|1 can (12 fl oz)=356
Red wine|85|0.1|2.6|0|0|0.6|4|0|1 glass (5 fl oz)=147
`;

export const COMMON_FOODS: Food[] = TABLE.trim().split('\n').map((line) => {
  const [name, kcal, protein, carbs, fat, fiber, sugar, sodium, satFat, servings] = line.split('|');
  return {
    id: 'common:' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    source: 'common' as const,
    name,
    baseQty: 100,
    baseUnit: 'g' as const,
    nutrients: {
      calories: +kcal, protein: +protein, carbs: +carbs, fat: +fat,
      fiber: +fiber, sugar: +sugar, sodium: +sodium, satFat: +satFat,
    },
    servings: withStandardServings('g', servings.split(';').map((s) => {
      const [label, grams] = s.split('=');
      return { label: `${label} (${Math.round(+grams)} g)`, qty: +grams };
    })),
  };
});

/** Rank-ordered matches: every query word must appear; names starting with the query come first. */
export function matchFoods<T extends { name: string; brand?: string }>(list: T[], query: string, limit = 20): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const scored: { item: T; score: number }[] = [];
  for (const item of list) {
    const hay = (item.name + ' ' + (item.brand ?? '')).toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    const name = item.name.toLowerCase();
    const score = (name.startsWith(words[0]) ? 0 : 10) + name.length / 100;
    scored.push({ item, score });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((s) => s.item);
}
