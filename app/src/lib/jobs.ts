import { getProfile, finishSheet, finishPhotoRead, finishGuide, finishLooks, setCapsuleOwned, type Profile } from './profiles';
import { excludedItems, keepExcluded } from './capsule';
import { readImage, saveImage } from './storage';
import { generateCharacterSheet } from './ai/gemini';
import { readPhoto } from './ai/claude';
import { generateGuide } from './ai/guide';
import { generateLooks } from './ai/looks';
import { generateTryon } from './ai/tryon';
import { getTryon, finishTryon } from './tryons';
import { stoppable, stopKey } from './stop';
import { beginLookImages, finishLookImage, finishLookRewrite, keyOf, lookImagePrompt, lookImageRow, lookImageStatus, type LookImageKey } from './look-images';
import { generateOutfits, generateReplacement } from './ai/outfits';
import { finishOutfit, finishOutfitRewrite, finishOutfitRun, getOutfit, getOutfitRun, previousOutfitNames, slotsFor } from './outfits';

const message = (e: unknown) => (e instanceof Error ? e.message : 'SOMETHING WENT WRONG. TRY AGAIN.');

async function currentPhoto(id: string, attempt: number): Promise<Buffer | null> {
  const p = await getProfile(id);
  if (!p || p.attempt !== attempt || !p.photoPath) return null;
  return readImage(p.photoPath);
}

/** Still the run that started, and nobody pressed Stop on it. */
async function stillPending(id: string, attempt: number): Promise<boolean> {
  const p = await getProfile(id);
  return p?.attempt === attempt && p.sheetStatus === 'pending';
}

export async function runSheetJob(id: string, attempt: number): Promise<void> {
  try {
    const photo = await currentPhoto(id, attempt);
    if (!photo) return;
    let sheet: Buffer;
    try {
      sheet = await stoppable(stopKey.sheet(id), (signal) => generateCharacterSheet(photo, signal));
    } catch (e) {
      await finishSheet(id, attempt, { error: message(e) });
      return;
    }
    // Stopped, or a new photo or retry while Gemini worked: write nothing.
    if (!(await stillPending(id, attempt))) return;
    if (await finishSheet(id, attempt, { path: await saveImage(id, 'sheet', sheet) })) await runLookImages(id);
  } catch (e) {
    console.error('sheet job failed', e);
  }
}

export async function runPhotoReadJob(id: string, attempt: number): Promise<void> {
  try {
    const photo = await currentPhoto(id, attempt);
    if (!photo) return;
    let read = null;
    try {
      read = await readPhoto(photo);
    } catch (e) {
      console.error('photo read failed', message(e));
    }
    await finishPhotoRead(id, attempt, read);
  } catch (e) {
    console.error('photo read job failed', e);
  }
}

export function startSheetJob(id: string, attempt: number): void {
  void runSheetJob(id, attempt);
}

export function startPhotoJobs(id: string, attempt: number): void {
  void runSheetJob(id, attempt);
  void runPhotoReadJob(id, attempt);
}

export async function runGuideJob(id: string, attempt: number): Promise<void> {
  try {
    const p = await getProfile(id);
    if (!p || p.guideAttempt !== attempt || !p.photoPath) return;
    const photo = await readImage(p.photoPath);
    let guide;
    try {
      guide = await stoppable(stopKey.guide(id), (signal) => generateGuide(p, photo, signal));
    } catch (e) {
      await finishGuide(id, attempt, { error: message(e) });
      return;
    }
    // Ticks can change while the guide is written, so read them now.
    const current = await getProfile(id);
    const kept = keepExcluded(guide, current ? excludedItems(current) : []);
    if (await finishGuide(id, attempt, { guide: kept.guide })) await setCapsuleOwned(id, kept.owned);
  } catch (e) {
    console.error('guide job failed', e);
  }
}

export async function runTryonJob(tryonId: string): Promise<void> {
  try {
    const t = await getTryon(tryonId);
    const p = t && (await getProfile(t.profileId));
    if (!t || !p?.sheetPath) return;
    const sheet = await readImage(p.sheetPath);
    let image: Buffer;
    try {
      image = await stoppable(stopKey.tryon(t.id), (signal) => generateTryon(sheet, t.prompt, signal));
    } catch (e) {
      await finishTryon(t.id, { error: message(e) });
      return;
    }
    // Stopped, or the profile deleted, while Gemini worked: write nothing then.
    if ((await getTryon(t.id))?.status !== 'pending') return;
    await finishTryon(t.id, { path: await saveImage(t.profileId, 'tryon', image) });
  } catch (e) {
    console.error('try-on job failed', e);
  }
}

export function startTryonJob(tryonId: string): void {
  void runTryonJob(tryonId);
}

export function startGuideJob(id: string, attempt: number): void {
  void runGuideJob(id, attempt);
}

export async function runLooksJob(id: string, attempt: number): Promise<void> {
  try {
    const p = await getProfile(id);
    if (!p || p.looksAttempt !== attempt || !p.photoPath) return;
    const photo = await readImage(p.photoPath);
    let looks;
    try {
      looks = await stoppable(stopKey.looks(id), (signal) => generateLooks(p, photo, signal));
    } catch (e) {
      await finishLooks(id, attempt, { error: message(e) });
      return;
    }
    if (await finishLooks(id, attempt, { looks })) await runLookImages(id);
  } catch (e) {
    console.error('looks job failed', e);
  }
}

export function startLooksJob(id: string, attempt: number): void {
  void runLooksJob(id, attempt);
}

// Gemini handles a few images at once; ten in parallel mostly hits rate limits.
const LOOK_IMAGES_AT_ONCE = 3;

async function stillCurrentLooks(k: LookImageKey): Promise<Profile | null> {
  const p = await getProfile(k.id);
  return p && p.looksAttempt === k.looksAttempt && p.attempt === k.sheetAttempt ? p : null;
}

export async function runLookImage(k: LookImageKey, idx: number): Promise<void> {
  try {
    const p = await stillCurrentLooks(k);
    const removed = p?.looks?.looks[idx];
    if (!p || !removed || !p.sheetPath) return;
    // Stop marks the pictures still waiting in the queue too; skip those.
    const row = await lookImageRow(k, idx);
    if (row?.status !== 'pending') return;
    const sheet = await readImage(p.sheetPath);
    let image: Buffer;
    try {
      let look = removed;
      if (row.replacing) {
        // The X was pressed on this look: write its replacement first.
        const photo = await readImage(p.photoPath!);
        const previous = [...(p.looks?.looks.map((l) => l.name) ?? []), ...(await previousOutfitNames(p.id))];
        const written = await stoppable(stopKey.looks(k.id), (signal) => generateReplacement(p, photo, { style: removed.style }, previous, removed.name, signal));
        look = { ...written, style: removed.style };
        if (!(await finishLookRewrite(k, idx, look))) return;
      }
      const dressed = look;
      image = await stoppable(stopKey.looks(k.id), (signal) => generateTryon(sheet, lookImagePrompt(p, dressed), signal));
    } catch (e) {
      await finishLookImage(k, idx, { error: message(e) });
      return;
    }
    // Stopped, a new sheet, new looks or a deleted profile while Gemini worked: write nothing.
    if (!(await stillCurrentLooks(k)) || (await lookImageStatus(k, idx)) !== 'pending') return;
    await finishLookImage(k, idx, { path: await saveImage(k.id, 'look', image) });
  } catch (e) {
    console.error('look image job failed', e);
  }
}

/** Makes the look pictures once both the looks and the character sheet are ready. Safe to call twice. */
export async function runLookImages(id: string): Promise<void> {
  try {
    const p = await getProfile(id);
    if (!p) return;
    const queue = await beginLookImages(p);
    const k = keyOf(p);
    const worker = async () => {
      for (let idx = queue.shift(); idx !== undefined; idx = queue.shift()) await runLookImage(k, idx);
    };
    await Promise.all(Array.from({ length: LOOK_IMAGES_AT_ONCE }, worker));
  } catch (e) {
    console.error('look images failed', e);
  }
}

export function startLookImages(id: string): void {
  void runLookImages(id);
}

export function startLookImage(k: LookImageKey, idx: number): void {
  void runLookImage(k, idx);
}

export async function runOutfitImage(outfitId: string): Promise<void> {
  try {
    const o = await getOutfit(outfitId);
    if (o?.status !== 'pending') return;
    const p = await getProfile(o.profileId);
    if (!p) return;
    let image: Buffer;
    try {
      if (!p.sheetPath) throw new Error('NEEDS YOUR CHARACTER SHEET. TRY AGAIN ONCE IT IS READY.');
      const sheet = await readImage(p.sheetPath);
      let look = o.look;
      if (o.replacing) {
        // The X was pressed on this outfit: write its replacement first.
        if (!p.photoPath) throw new Error('NEEDS YOUR PHOTO. ADD ONE AND TRY AGAIN.');
        const photo = await readImage(p.photoPath);
        const previous = await previousOutfitNames(p.id);
        look = await stoppable(stopKey.outfits(p.id), (signal) =>
          generateReplacement(p, photo, { season: o.season, style: o.style }, previous, o.look.name, signal));
        if (!(await finishOutfitRewrite(o.id, look))) return;
      }
      const dressed = look;
      image = await stoppable(stopKey.outfits(p.id), (signal) => generateTryon(sheet, lookImagePrompt(p, dressed), signal));
    } catch (e) {
      await finishOutfit(o.id, { error: message(e) });
      return;
    }
    // Stopped, or the profile deleted, while Gemini worked: write nothing.
    if ((await getOutfit(o.id))?.status !== 'pending') return;
    await finishOutfit(o.id, { path: await saveImage(p.id, 'outfit', image) });
  } catch (e) {
    console.error('outfit image job failed', e);
  }
}

/** Writes a run's ten outfits, then makes their pictures. */
export async function runOutfitsJob(runId: string): Promise<void> {
  try {
    const run = await getOutfitRun(runId);
    const p = run && (await getProfile(run.profileId));
    if (!run || !p || run.status !== 'pending') return;
    let looks;
    try {
      if (!p.photoPath) throw new Error('NEEDS YOUR PHOTO. ADD ONE AND TRY AGAIN.');
      const photo = await readImage(p.photoPath);
      const previous = await previousOutfitNames(p.id);
      looks = await stoppable(stopKey.outfits(p.id), (signal) => generateOutfits(p, photo, slotsFor(run), previous, signal));
    } catch (e) {
      await finishOutfitRun(runId, { error: message(e) });
      return;
    }
    const queue = await finishOutfitRun(runId, { looks });
    const worker = async () => {
      for (let id = queue.shift(); id !== undefined; id = queue.shift()) await runOutfitImage(id);
    };
    await Promise.all(Array.from({ length: LOOK_IMAGES_AT_ONCE }, worker));
  } catch (e) {
    console.error('outfits job failed', e);
  }
}

export function startOutfitsJob(runId: string): void {
  void runOutfitsJob(runId);
}

export function startOutfitImage(outfitId: string): void {
  void runOutfitImage(outfitId);
}
