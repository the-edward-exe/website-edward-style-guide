import type { Guide } from '../guide';

// Demo mode (no ANTHROPIC_API_KEY): a fixed, valid guide adapted from the original Style File outfits.
type P = [string, string, string, string, string, string[]];
const piece = ([item, color, hex, fabric, search, stores]: P) => ({ item, color, hex, fabric, search, stores: stores as any });

export const DEMO_GUIDE: Guide = {
  summary: 'Demo guide. Add ANTHROPIC_API_KEY to .env for a guide written for you. This one shows the shape of the result: an earth, gray and navy palette, tailored but easy fits, and twelve outfits across work, weekend, evening and travel.',
  families: [
    { name: 'Core neutrals', purpose: 'Your base layer. Most pieces should be in these.', swatches: [
      { name: 'Charcoal', hex: '#2E3238' }, { name: 'Mid gray', hex: '#7D8188' }, { name: 'Stone', hex: '#C9C6BF' }, { name: 'Oat white', hex: '#EDE9E1' }] },
    { name: 'Earth accents', purpose: 'Warmth near the face. One per outfit.', swatches: [
      { name: 'Tobacco', hex: '#6B4A33' }, { name: 'Rust', hex: '#9A5A3A' }, { name: 'Olive', hex: '#5B5F3F' }, { name: 'Camel', hex: '#B08A62' }] },
    { name: 'Navy family', purpose: 'Your dark anchor in place of black.', swatches: [
      { name: 'Midnight', hex: '#1C2738' }, { name: 'Navy', hex: '#2B3F5C' }, { name: 'Indigo', hex: '#3E5F85' }, { name: 'Chambray', hex: '#8FA4BE' }] },
  ],
  fitRules: [
    { title: 'Tailored, not tight', body: 'Fabric should skim the chest and drape at the waist without pulling at buttons.' },
    { title: 'Shirts end mid-fly', body: 'Untucked shirts that end mid-fly look deliberate. Longer reads sloppy.' },
    { title: 'Little or no break', body: 'Hem trousers so the fabric just meets the shoe. Straight or gently tapered legs.' },
  ],
  stylingRules: [
    { title: 'Three colors per outfit', body: 'One base, one support, one accent. Navy base, gray support, rust accent.' },
    { title: 'Texture does the work', body: 'Neutral outfits need contrast in surface: suede with denim, waffle knit with twill.' },
    { title: 'Navy instead of black', body: 'Charcoal and navy give the same sharpness without draining your skin.' },
  ],
  capsule: [
    { item: 'Navy overshirt', category: 'outer' }, { item: 'Olive field jacket', category: 'outer' },
    { item: 'Navy unstructured blazer', category: 'tailoring' }, { item: 'Charcoal wool trousers', category: 'bottoms' },
    { item: 'Stone chinos', category: 'bottoms' }, { item: 'Dark indigo jeans', category: 'bottoms' },
    { item: 'White oxford shirt', category: 'shirts' }, { item: 'Chambray shirt', category: 'shirts' },
    { item: 'Gray heather tees', category: 'basics' }, { item: 'Camel merino crew', category: 'knits' },
    { item: 'Navy knit polo', category: 'knits' }, { item: 'Brown suede chukka', category: 'shoes' },
    { item: 'Dark brown leather loafer', category: 'shoes' }, { item: 'White leather sneaker', category: 'shoes' },
  ],
  outfits: [
    { id: 'o01', name: 'Navy Overshirt Weekday', occasion: 'Work', season: 'Fall', setting: 'a modern office lobby with concrete and wood', why: 'Navy on top, warm stone below and brown suede at the feet. Put-together without a jacket.', pieces: [
      piece(['Wool-blend overshirt', 'Navy', '#2B3F5C', '12 oz brushed wool blend', 'navy wool overshirt', ['jcrew', 'llbean']]),
      piece(['Crewneck tee', 'Heather gray', '#9A9DA2', 'Heavyweight cotton', 'heather gray heavyweight crewneck t-shirt', ['uniqlo', 'everlane']]),
      piece(['Slim-straight chinos', 'Stone', '#C9C2B3', 'Stretch twill', 'stone slim straight chinos', ['jcrew', 'br']]),
      piece(['Suede chukka boots', 'Brown', '#6B4A33', 'Suede, crepe sole', 'brown suede chukka boots', ['thursday', 'clarks']])] },
    { id: 'o02', name: 'Camel and Charcoal', occasion: 'Work', season: 'Winter', setting: 'a bright office with large windows', why: 'Camel knit over a white collar, with charcoal trousers to keep it serious.', pieces: [
      piece(['Merino crewneck sweater', 'Camel', '#B08A62', 'Fine-gauge merino', 'camel merino crewneck sweater', ['uniqlo', 'jcrew']]),
      piece(['Oxford cloth shirt', 'White', '#F1EFEA', 'Oxford cotton', 'white oxford button down shirt', ['jcrew', 'llbean']]),
      piece(['Wool trousers', 'Charcoal', '#2E3238', 'Tropical wool', 'charcoal wool trousers', ['br', 'jcrew']]),
      piece(['Leather derby shoes', 'Dark brown', '#4A3324', 'Calfskin', 'dark brown leather derby shoes', ['clarks', 'nordstrom']])] },
    { id: 'o03', name: 'Olive Field Jacket', occasion: 'Weekend', season: 'Fall', setting: 'a tree-lined city street in autumn', why: 'Olive and indigo are natural partners. A white tee keeps the face bright.', pieces: [
      piece(['Cotton field jacket', 'Olive', '#5B5F3F', 'Washed cotton twill', 'olive cotton field jacket', ['llbean', 'huck']]),
      piece(['Crewneck tee', 'White', '#F1EFEA', 'Heavyweight cotton', 'white heavyweight crewneck t-shirt', ['everlane', 'uniqlo']]),
      piece(['Straight jeans', 'Dark indigo', '#1F2E4A', '14 oz denim', 'dark indigo straight jeans', ['madewell', 'jcrew']]),
      piece(['Leather lace-up boots', 'Tan', '#9C6B43', 'Oiled leather', 'tan leather lace up boots', ['thursday', 'nordstrom']])] },
    { id: 'o04', name: 'Tonal Grays', occasion: 'Work', season: 'Winter', setting: 'a minimalist gallery with white walls', why: 'Three grays in three textures. It looks expensive and is hard to get wrong.', pieces: [
      piece(['Merino quarter-zip', 'Mid gray', '#7D8188', 'Merino wool', 'gray merino quarter zip sweater', ['uniqlo', 'br']]),
      piece(['Long-sleeve tee', 'Light gray', '#C3C3C1', 'Cotton jersey', 'light gray long sleeve t-shirt', ['uniqlo', 'everlane']]),
      piece(['Tailored chinos', 'Charcoal', '#2E3238', 'Stretch twill', 'charcoal tailored chinos', ['br', 'jcrew']]),
      piece(['Suede sneakers', 'Gray', '#8E8F90', 'Suede low top', 'gray suede low top sneakers', ['nordstrom', 'huck']])] },
    { id: 'o05', name: 'Chambray and Denim', occasion: 'Weekend', season: 'Spring', setting: 'a sunny farmers market', why: 'Light blue on top, dark blue below. The shade contrast keeps it from looking like a uniform.', pieces: [
      piece(['Chambray shirt', 'Chambray blue', '#8FA4BE', 'Lightweight chambray', 'chambray button up shirt', ['jcrew', 'llbean']]),
      piece(['Straight jeans', 'Dark indigo', '#1F2E4A', 'Stretch denim', 'dark indigo straight jeans', ['madewell', 'landsend']]),
      piece(['Leather belt', 'Brown', '#6B4A33', 'Full-grain leather', 'brown full grain leather belt', ['llbean', 'nordstrom']]),
      piece(['Leather sneakers', 'White', '#F1EFEA', 'Smooth leather', 'white leather minimalist sneakers', ['everlane', 'nordstrom']])] },
    { id: 'o06', name: 'Tobacco Cord Evening', occasion: 'Evening', season: 'Fall', setting: 'a dim, warm restaurant bar with wood paneling', why: 'A tobacco corduroy jacket over a navy knit is relaxed but clearly dressed up.', pieces: [
      piece(['Corduroy jacket', 'Tobacco', '#6B4A33', 'Mid-wale corduroy, unlined', 'brown corduroy jacket', ['jcrew', 'nordstrom']]),
      piece(['Long-sleeve knit polo', 'Navy', '#2B3F5C', 'Merino knit', 'navy long sleeve knit polo', ['br', 'jcrew']]),
      piece(['Wool trousers', 'Charcoal', '#2E3238', 'Flannel wool', 'charcoal wool flannel trousers', ['jcrew', 'br']]),
      piece(['Suede loafers', 'Dark brown', '#4A3324', 'Suede', 'dark brown suede loafers', ['nordstrom', 'clarks']])] },
    { id: 'o07', name: 'Navy Suit, No Tie', occasion: 'Evening', season: 'All year', setting: 'a city rooftop at dusk', why: 'The most useful formal outfit. Soft shoulders and an open collar keep it easy.', pieces: [
      piece(['Unstructured suit', 'Navy', '#24364F', 'Wool, soft shoulder', 'navy unstructured suit', ['jcrew', 'br']]),
      piece(['Oxford shirt, open collar', 'White', '#F1EFEA', 'Oxford cotton', 'white oxford dress shirt', ['jcrew', 'br']]),
      piece(['Leather loafers', 'Dark brown', '#4A3324', 'Calfskin', 'dark brown leather loafers', ['clarks', 'nordstrom']])] },
    { id: 'o08', name: 'Summer Linen', occasion: 'Weekend', season: 'Summer', setting: 'a shaded patio on a hot summer day', why: 'Linen breathes in the heat, and the camp collar sits flat without effort.', pieces: [
      piece(['Linen camp-collar shirt', 'Oat', '#E2D8C6', 'Washed linen', 'oatmeal linen camp collar shirt', ['jcrew', 'quince']]),
      piece(['Chino shorts, 7 in', 'Navy', '#2B3F5C', 'Stretch cotton', 'navy chino shorts 7 inch', ['jcrew', 'landsend']]),
      piece(['Canvas sneakers', 'Off white', '#EDE9E1', 'Canvas', 'off white canvas low top sneakers', ['nordstrom', 'huck']])] },
    { id: 'o09', name: 'Stone Henley Casual', occasion: 'Weekend', season: 'Spring', setting: 'a coffee shop with a brick wall', why: 'A waffle henley has texture and a soft neckline. Olive and stone stay quiet.', pieces: [
      piece(['Waffle henley', 'Stone', '#C9C2B3', 'Waffle-knit cotton', 'stone waffle knit henley', ['llbean', 'jcrew']]),
      piece(['Slim chinos', 'Olive', '#5B5F3F', 'Stretch twill', 'olive slim chinos', ['jcrew', 'uniqlo']]),
      piece(['Desert boots', 'Brown suede', '#8A6446', 'Suede, crepe sole', 'brown suede desert boots', ['clarks', 'thursday']])] },
    { id: 'o10', name: 'Navy Peacoat Winter', occasion: 'Work', season: 'Winter', setting: 'a cold city sidewalk in winter', why: 'Navy wool over charcoal and gray flannel is the cold-weather uniform that never dates.', pieces: [
      piece(['Wool peacoat', 'Navy', '#1C2738', 'Melton wool', 'navy wool peacoat', ['jcrew', 'llbean']]),
      piece(['Merino crewneck', 'Charcoal', '#2E3238', 'Merino wool', 'charcoal merino crewneck sweater', ['uniqlo', 'everlane']]),
      piece(['Flannel trousers', 'Mid gray', '#7D8188', 'Wool flannel', 'gray wool flannel trousers', ['jcrew', 'br']]),
      piece(['Leather Chelsea boots', 'Dark brown', '#4A3324', 'Leather', 'dark brown leather chelsea boots', ['thursday', 'nordstrom']])] },
    { id: 'o11', name: 'Travel Day', occasion: 'Travel', season: 'All year', setting: 'an airport terminal with large windows', why: 'Stretch fabrics in dark neutrals hide wrinkles. Looks like slacks and a sweater, feels like sweats.', pieces: [
      piece(['Performance quarter-zip', 'Charcoal', '#2E3238', 'Merino blend', 'charcoal performance quarter zip', ['huck', 'uniqlo']]),
      piece(['Tech travel pants', 'Navy', '#24364F', 'Four-way stretch', 'navy stretch travel pants', ['huck', 'br']]),
      piece(['Knit sneakers', 'Gray', '#8E8F90', 'Knit upper', 'gray knit sneakers', ['nordstrom', 'everlane']])] },
    { id: 'o12', name: 'Sunday Cable Knit', occasion: 'Weekend', season: 'Winter', setting: 'a cozy living room with a reading chair', why: 'An oatmeal cable knit with relaxed trousers is comfort that still looks chosen.', pieces: [
      piece(['Cable-knit crewneck', 'Oatmeal', '#D9CDB8', 'Cotton-wool cable knit', 'oatmeal cable knit sweater', ['llbean', 'jcrew']]),
      piece(['Drawstring trousers', 'Charcoal', '#2E3238', 'Brushed wool blend', 'charcoal drawstring trousers', ['uniqlo', 'huck']]),
      piece(['Leather sneakers', 'White', '#F1EFEA', 'Smooth leather', 'white leather sneakers', ['everlane', 'nordstrom']])] },
  ],
};
