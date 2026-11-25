import { STEPS, stepComplete } from './questionnaire';
import type { Profile } from './profiles';

export type NavKey = 'questions' | 'sheet' | 'guide' | 'room' | 'dressing';

export type NavItem = {
  key: NavKey;
  label: string;
  /** Null while locked. */
  href: string | null;
  /** Why it can't be opened yet. */
  locked: string | null;
  done: boolean;
  /** The step to do now. */
  next: boolean;
  current: boolean;
};

/** The parts of one profile, as the navigation bar shows them. */
export function profileNav(p: Profile, current?: NavKey): NavItem[] {
  const base = `/p/${p.id}`;
  const firstOpen = STEPS.find((s) => !stepComplete(p.answers, s.n));
  const needPhoto = p.photoPath ? null : 'Add your photo first';

  const item = (key: NavKey, label: string, path: string, locked: string | null, done = false): NavItem => ({
    key, label, href: locked ? null : path, locked, done, next: false, current: key === current,
  });
  const questions = item('questions', 'Questions', `${base}/q/${firstOpen?.n ?? 1}`, needPhoto, !firstOpen);
  // The photo is added on the character sheet page, so that page is always open.
  const sheet = item('sheet', 'Character sheet', `${base}/sheet`, null, p.sheetApproved);
  const guide = item('guide', 'Style guide', base, p.sheetApproved ? null : 'Approve your character sheet first', p.guideStatus === 'ready');
  const room = item('room', 'Your Colors', `${base}#room`, p.sheetApproved && p.guideStatus === 'ready' ? null : 'Your style guide has to finish first');
  const dressing = item('dressing', 'Dressing Room', `${base}/dressing`, needPhoto ?? (firstOpen ? 'Finish your questions first' : null));

  // What to do next follows the real order of work, whatever order the bar shows.
  const next = p.photoPath ? [questions, sheet, guide].find((s) => !s.done && !s.locked) : sheet;
  if (next) next.next = true;

  return [sheet, questions, guide, room, dressing];
}
