import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db, goalForDate, totals, type Entry, type ExerciseEntry } from '../lib/db';
import type { DayGoal, Nutrients } from '../lib/nutrition';
import { useSettings } from './ctx';

export interface DayData {
  loading: boolean;
  entries: Entry[];
  exercises: ExerciseEntry[];
  waterMl: number;
  goal: DayGoal;
  eaten: Nutrients;
  burned: number;
  /** Calories available for the day: the goal plus exercise when that setting is on. */
  budget: number;
  remaining: number;
}

/** Everything logged on one day, kept live as the diary changes. */
export function useDay(date: string): DayData {
  const { settings } = useSettings();
  const entries = useLiveQuery(() => db.entries.where('date').equals(date).sortBy('createdAt'), [date]);
  const exercises = useLiveQuery(() => db.exercises.where('date').equals(date).sortBy('createdAt'), [date]);
  const water = useLiveQuery(() => db.water.get(date).then((w) => w?.ml ?? 0), [date]);

  return useMemo(() => {
    const e = entries ?? [];
    const x = exercises ?? [];
    const goal = goalForDate(settings.goals, date);
    const eaten = totals(e);
    const burned = x.reduce((a, b) => a + (b.calories || 0), 0);
    const budget = goal.calories + (settings.goals.addExercise ? burned : 0);
    return {
      loading: entries === undefined,
      entries: e, exercises: x, waterMl: water ?? 0, goal, eaten, burned, budget,
      remaining: budget - (eaten.calories ?? 0),
    };
  }, [entries, exercises, water, settings.goals, date]);
}
