// Store catalog. The first 16 come from the original guide (index.html STORES); the rest add women's coverage.
export type Section = 'mens' | 'womens';
export type Store = { name: string; url: string; tier: '$' | '$$' | '$$$'; sections: Section[]; note: string };

const both: Section[] = ['mens', 'womens'];

export const STORES = {
  uniqlo: { name: 'Uniqlo', url: 'https://www.uniqlo.com/us/en/', tier: '$', sections: both, note: 'Merino, Supima tees, chinos and Airism basics. Best value for knits and layers.' },
  jcrew: { name: 'J.Crew', url: 'https://www.jcrew.com/', tier: '$$', sections: both, note: 'Oxfords, chinos, cashmere and tailoring. Frequent sales.' },
  br: { name: 'Banana Republic', url: 'https://bananarepublic.gap.com/', tier: '$$', sections: both, note: 'Clean tailored trousers, suede and knit polos with a dressier finish.' },
  todd: { name: 'Todd Snyder', url: 'https://www.toddsnyder.com/', tier: '$$$', sections: ['mens'], note: 'Sport coats, suede, Italian knits. The upgrade store for evening and business.' },
  taylor: { name: 'Taylor Stitch', url: 'https://www.taylorstitch.com/', tier: '$$$', sections: ['mens'], note: 'Workwear jackets, chore coats, heavy oxfords. Earth-toned by default.' },
  llbean: { name: 'L.L.Bean', url: 'https://www.llbean.com/', tier: '$$', sections: both, note: 'Flannels, field coats, quilted vests. Generous and slim fits.' },
  huck: { name: 'Huckberry', url: 'https://huckberry.com/', tier: '$$', sections: both, note: 'Curated outdoor and workwear brands, travel pants and basics.' },
  everlane: { name: 'Everlane', url: 'https://www.everlane.com/', tier: '$$', sections: both, note: 'Minimal tees, cashmere crews and clean white sneakers.' },
  buck: { name: 'Buck Mason', url: 'https://www.buckmason.com/', tier: '$$', sections: ['mens'], note: 'Heavyweight tees, henleys and suede truckers with a lived-in look.' },
  thursday: { name: 'Thursday Boot Co.', url: 'https://thursdayboots.com/', tier: '$$', sections: both, note: 'Chelsea boots, chukkas and desert boots at fair prices.' },
  redwing: { name: 'Red Wing', url: 'https://www.redwingshoes.com/', tier: '$$$', sections: ['mens'], note: 'Moc toe and Iron Ranger boots. Resoleable for a decade.' },
  clarks: { name: 'Clarks', url: 'https://www.clarks.com/en-us', tier: '$$', sections: both, note: 'The original desert boot and comfortable leather loafers.' },
  allen: { name: 'Allen Edmonds', url: 'https://www.allenedmonds.com/', tier: '$$$', sections: ['mens'], note: 'Derbies, oxfords and loafers for business looks.' },
  nordstrom: { name: 'Nordstrom', url: 'https://www.nordstrom.com/', tier: '$$', sections: both, note: 'Many brands in one place, with free alterations on full-price items.' },
  landsend: { name: "Lands' End", url: 'https://www.landsend.com/', tier: '$', sections: both, note: 'Extended sizing, easy chinos and polos, many lengths.' },
  filson: { name: 'Filson', url: 'https://www.filson.com/', tier: '$$$', sections: ['mens'], note: 'Tin cloth and waxed jackets, wool vests. Heirloom outerwear.' },
  madewell: { name: 'Madewell', url: 'https://www.madewell.com/', tier: '$$', sections: both, note: 'Denim in many fits, easy knits and leather bags.' },
  aritzia: { name: 'Aritzia', url: 'https://www.aritzia.com/us/en', tier: '$$', sections: ['womens'], note: 'Tailored trousers, knits and outerwear with a clean line.' },
  cos: { name: 'COS', url: 'https://www.cos.com/en-us', tier: '$$', sections: both, note: 'Minimal, structured pieces in quiet colors.' },
  reformation: { name: 'Reformation', url: 'https://www.thereformation.com/', tier: '$$$', sections: ['womens'], note: 'Dresses, denim and knits with a defined waist.' },
  quince: { name: 'Quince', url: 'https://www.quince.com/', tier: '$', sections: both, note: 'Cashmere, silk and linen basics at low prices.' },
  vince: { name: 'Vince', url: 'https://www.vince.com/', tier: '$$$', sections: both, note: 'Soft tailoring, cashmere and leather in neutrals.' },
  sezane: { name: 'Sézane', url: 'https://www.sezane.com/us', tier: '$$$', sections: ['womens'], note: 'French knits, blouses and denim with vintage detail.' },
  gap: { name: 'Gap', url: 'https://www.gap.com/', tier: '$', sections: both, note: 'Denim, tees and everyday basics in wide size ranges.' },
} satisfies Record<string, Store>;

export type StoreId = keyof typeof STORES;
export const STORE_IDS = Object.keys(STORES) as [StoreId, ...StoreId[]];

const TIER_RANK = { $: 1, $$: 2, $$$: 3 } as const;

type Tier = '$' | '$$' | '$$$';

/** Stores that sell for this section and sit at or one tier above the highest budget picked. */
export function storesFor(section: 'mens' | 'womens' | 'both' | undefined, budget: Tier | Tier[] | undefined): StoreId[] {
  const tiers = Array.isArray(budget) ? budget : budget ? [budget] : [];
  const max = Math.max(...(tiers.length ? tiers : ['$$' as Tier]).map((t) => TIER_RANK[t])) + 1;
  return STORE_IDS.filter((id) => {
    const s: Store = STORES[id];
    const fitsSection = !section || section === 'both' || s.sections.includes(section);
    return fitsSection && TIER_RANK[s.tier] <= max;
  });
}
