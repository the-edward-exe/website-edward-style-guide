import { getProfile, finishSheet, finishPhotoRead, finishGuide, finishLooks } from './profiles';
import { readImage, saveImage } from './storage';
import { generateCharacterSheet } from './ai/gemini';
import { readPhoto } from './ai/claude';
import { generateGuide } from './ai/guide';
import { generateLooks } from './ai/looks';
import { generateTryon } from './ai/tryon';
import { getTryon, finishTryon } from './tryons';

const message = (e: unknown) => (e instanceof Error ? e.message : 'SOMETHING WENT WRONG. TRY AGAIN.');

async function currentPhoto(id: string, attempt: number): Promise<Buffer | null> {
  const p = await getProfile(id);
  if (!p || p.attempt !== attempt || !p.photoPath) return null;
  return readImage(p.photoPath);
}

async function stillCurrent(id: string, attempt: number): Promise<boolean> {
  return (await getProfile(id))?.attempt === attempt;
}

export async function runSheetJob(id: string, attempt: number): Promise<void> {
  try {
    const photo = await currentPhoto(id, attempt);
    if (!photo) return;
    let sheet: Buffer;
    try {
      sheet = await generateCharacterSheet(photo);
    } catch (e) {
      await finishSheet(id, attempt, { error: message(e) });
      return;
    }
    if (!(await stillCurrent(id, attempt))) return;
    await finishSheet(id, attempt, { path: await saveImage(id, 'sheet', sheet) });
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
    let guide;
    try {
      guide = await generateGuide(p, await readImage(p.photoPath));
    } catch (e) {
      await finishGuide(id, attempt, { error: message(e) });
      return;
    }
    await finishGuide(id, attempt, { guide });
  } catch (e) {
    console.error('guide job failed', e);
  }
}

export async function runTryonJob(tryonId: string): Promise<void> {
  try {
    const t = await getTryon(tryonId);
    const p = t && (await getProfile(t.profileId));
    if (!t || !p?.sheetPath) return;
    let image: Buffer;
    try {
      image = await generateTryon(await readImage(p.sheetPath), t.prompt);
    } catch (e) {
      await finishTryon(t.id, { error: message(e) });
      return;
    }
    // The profile may have been deleted while Gemini worked; write nothing then.
    if (!(await getTryon(t.id))) return;
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
    let looks;
    try {
      looks = await generateLooks(p, await readImage(p.photoPath));
    } catch (e) {
      await finishLooks(id, attempt, { error: message(e) });
      return;
    }
    await finishLooks(id, attempt, { looks });
  } catch (e) {
    console.error('looks job failed', e);
  }
}

export function startLooksJob(id: string, attempt: number): void {
  void runLooksJob(id, attempt);
}
