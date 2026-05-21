/**
 * Static habit templates used by the onboarding "pick from recommended"
 * flow. Lives as code (not a table) because the catalogue is small + we
 * never need to edit it at runtime.
 */
export type Interest =
  | 'health' | 'fitness' | 'reading' | 'productivity' | 'mindfulness' | 'learning';

export interface HabitTemplate {
  id: string;                // stable slug for the frontend to identify by
  interest: Interest;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  goal_type: 'daily' | 'weekly';
  target_value: number;
}

export const INTERESTS: { id: Interest; label: string; icon: string }[] = [
  { id: 'health',       label: 'Health',       icon: 'fa-heart' },
  { id: 'fitness',      label: 'Fitness',      icon: 'fa-dumbbell' },
  { id: 'reading',      label: 'Reading',      icon: 'fa-book' },
  { id: 'productivity', label: 'Productivity', icon: 'fa-briefcase' },
  { id: 'mindfulness',  label: 'Mindfulness',  icon: 'fa-leaf' },
  { id: 'learning',     label: 'Learning',     icon: 'fa-graduation-cap' }
];

export const TEMPLATES: HabitTemplate[] = [
  // health
  { id: 'water-8',     interest: 'health',       name: 'Drink 8 cups of water',   description: 'Hydrate through the day. Log each cup.', difficulty: 'easy',   goal_type: 'daily', target_value: 8 },
  { id: 'sleep-8h',    interest: 'health',       name: 'Get 8 hours of sleep',    description: 'Lights out on time.',                    difficulty: 'medium', goal_type: 'daily', target_value: 1 },
  { id: 'no-soda',     interest: 'health',       name: 'No sugary drinks',        description: 'Pass on the sweet stuff today.',         difficulty: 'medium', goal_type: 'daily', target_value: 1 },
  // fitness
  { id: 'walk-10k',    interest: 'fitness',      name: 'Walk 10,000 steps',       description: 'Hit your daily step goal.',              difficulty: 'medium', goal_type: 'daily', target_value: 1 },
  { id: 'workout-30',  interest: 'fitness',      name: '30 min workout',          description: 'Move with intent for half an hour.',     difficulty: 'hard',   goal_type: 'daily', target_value: 1 },
  { id: 'pushups-20',  interest: 'fitness',      name: '20 push-ups',             description: 'Log each set toward the target.',         difficulty: 'easy',   goal_type: 'daily', target_value: 20 },
  // reading
  { id: 'read-20p',    interest: 'reading',      name: 'Read 20 pages',           description: 'Keep the reading habit alive.',          difficulty: 'medium', goal_type: 'daily', target_value: 1 },
  { id: 'read-article',interest: 'reading',      name: 'Read one article',        description: 'A quick win — one solid article.',        difficulty: 'easy',   goal_type: 'daily', target_value: 1 },
  // productivity
  { id: 'deep-45',     interest: 'productivity', name: 'Deep-work block 45 min',  description: 'Phone away, single task, 45 minutes.',   difficulty: 'medium', goal_type: 'daily', target_value: 1 },
  { id: 'inbox-zero',  interest: 'productivity', name: 'Clear inbox to zero',     description: 'Triage + archive everything by EOD.',     difficulty: 'medium', goal_type: 'daily', target_value: 1 },
  { id: 'plan-tomr',   interest: 'productivity', name: "Plan tomorrow's top 3",    description: 'Three priorities written before bed.',   difficulty: 'easy',   goal_type: 'daily', target_value: 1 },
  // mindfulness
  { id: 'meditate-10', interest: 'mindfulness',  name: 'Meditate 10 min',         description: 'Calm the brain, 10 minutes.',            difficulty: 'easy',   goal_type: 'daily', target_value: 1 },
  { id: 'gratitude-3', interest: 'mindfulness',  name: 'Write 3 gratitudes',      description: 'Three things you appreciated today.',     difficulty: 'easy',   goal_type: 'daily', target_value: 3 },
  { id: 'walk-no-phn', interest: 'mindfulness',  name: '10 min phone-free walk',  description: 'Walk outside, leave the phone behind.',   difficulty: 'easy',   goal_type: 'daily', target_value: 1 },
  // learning
  { id: 'words-5',     interest: 'learning',     name: 'Learn 5 new words',       description: 'Foreign language? Vocab list? Up to you.',difficulty: 'easy',   goal_type: 'daily', target_value: 5 },
  { id: 'duolingo',    interest: 'learning',     name: 'Language lesson',         description: 'One Duolingo / Memrise / Anki session.',  difficulty: 'easy',   goal_type: 'daily', target_value: 1 },
  { id: 'code-30',     interest: 'learning',     name: '30 min coding practice',  description: 'LeetCode, side project, anything.',       difficulty: 'medium', goal_type: 'daily', target_value: 1 },
  { id: 'video-tut',   interest: 'learning',     name: 'Watch a tutorial',        description: 'Educational video, ≥10 minutes.',         difficulty: 'easy',   goal_type: 'daily', target_value: 1 }
];

/** Recommend up to `limit` templates matching the requested interests. */
export function recommendFor(interests: Interest[], limit: number = 6): HabitTemplate[] {
  if (!interests.length) return TEMPLATES.slice(0, limit);
  const wanted = new Set(interests);
  // Pick a mix: 2 from each requested interest at most, up to `limit`.
  const out: HabitTemplate[] = [];
  for (const i of interests) {
    const forI = TEMPLATES.filter(t => t.interest === i).slice(0, 2);
    for (const t of forI) {
      if (out.length >= limit) break;
      out.push(t);
    }
    if (out.length >= limit) break;
  }
  // Backfill with anything else if we're short
  for (const t of TEMPLATES) {
    if (out.length >= limit) break;
    if (out.find(x => x.id === t.id)) continue;
    out.push(t);
  }
  return out;
}

export function templateById(id: string): HabitTemplate | undefined {
  return TEMPLATES.find(t => t.id === id);
}
