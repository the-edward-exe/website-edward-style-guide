import type { Looks } from '../looks';

// Demo mode (no ANTHROPIC_API_KEY): ten fixed looks in the earthy palette of the original Style File.
type P = [string, string, string];
const look = (name: string, style: string, why: string, pieces: P[]) =>
  ({ name, style, why, pieces: pieces.map(([item, color, hex]) => ({ item, color, hex })) });

export const DEMO_LOOKS: Looks = {
  looks: [
    look('Navy Overshirt and Stone Chinos', 'Smart-casual', 'Demo look. Navy and stone sit well against warm skin without washing it out.', [
      ['Wool overshirt', 'Navy', '#2B3F5C'], ['Crewneck tee', 'Heather gray', '#9A9DA2'], ['Chinos', 'Stone', '#C9C2B3'], ['Suede chukkas', 'Tobacco', '#6B4A33']]),
    look('Olive Field Jacket and Cream Knit', 'Rugged / workwear', 'Demo look. Olive and cream bring warmth near the face.', [
      ['Field jacket', 'Olive', '#5B5F3F'], ['Waffle knit', 'Cream', '#EDE9E1'], ['Straight jeans', 'Dark indigo', '#2A3550'], ['Leather boots', 'Brown', '#5A3B26']]),
    look('Camel Crew and Charcoal Trousers', 'Classic', 'Demo look. Camel lifts the skin; charcoal keeps it sharp.', [
      ['Merino crew', 'Camel', '#B08A62'], ['Wool trousers', 'Charcoal', '#2E3238'], ['Leather loafers', 'Dark brown', '#4A3022']]),
    look('Rust Shirt and Indigo Denim', 'Rugged / workwear', 'Demo look. Rust is an earth accent that flatters warm undertones.', [
      ['Flannel shirt', 'Rust', '#9A5A3A'], ['White tee', 'Oat white', '#EDE9E1'], ['Straight jeans', 'Indigo', '#3E5F85'], ['Moc-toe boots', 'Tan', '#A0703F']]),
    look('Tonal Gray Layers', 'Minimal', 'Demo look. Soft grays read clean without the harshness of black.', [
      ['Knit polo', 'Mid gray', '#7D8188'], ['Trousers', 'Charcoal', '#2E3238'], ['Leather sneakers', 'White', '#F5F5F2']]),
    look('Chambray and Khaki Weekend', 'Preppy', 'Demo look. Light blue and khaki keep the face bright.', [
      ['Chambray shirt', 'Chambray', '#8FA4BE'], ['Chinos', 'Khaki', '#B9A27E'], ['Canvas sneakers', 'Navy', '#24364F']]),
    look('Midnight Blazer Evening', 'Classic', 'Demo look. Midnight navy gives the depth of black with more warmth.', [
      ['Unstructured blazer', 'Midnight', '#1C2738'], ['Oxford shirt', 'White', '#F5F5F2'], ['Wool trousers', 'Mid gray', '#7D8188'], ['Loafers', 'Dark brown', '#4A3022']]),
    look('Oatmeal Hoodie and Olive Cargo', 'Streetwear', 'Demo look. Oatmeal and olive keep a relaxed outfit warm in tone.', [
      ['Hoodie', 'Oatmeal', '#D8CDB8'], ['Cargo pants', 'Olive', '#5B5F3F'], ['Retro sneakers', 'Cream', '#EDE9E1']]),
    look('Brown Suede Trucker', 'Edgy', 'Demo look. Brown suede gives texture and edge without stark contrast.', [
      ['Suede trucker jacket', 'Tobacco', '#6B4A33'], ['Heavyweight tee', 'Charcoal', '#2E3238'], ['Slim jeans', 'Washed black', '#3A3A3C'], ['Chelsea boots', 'Dark brown', '#4A3022']]),
    look('Linen Travel Set', 'Minimal', 'Demo look. Sand and navy breathe in heat and suit warm skin.', [
      ['Linen shirt', 'Sand', '#D9C7A6'], ['Drawstring trousers', 'Navy', '#2B3F5C'], ['Leather sandals', 'Tan', '#A0703F']]),
  ],
};
