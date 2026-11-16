// Calories burned are estimated as MET x body weight (kg) x hours, using values
// from the Compendium of Physical Activities. It is an estimate, not a measurement.

export interface Activity {
  name: string;
  met: number;
  kind: 'cardio' | 'strength';
}

export const ACTIVITIES: Activity[] = [
  { name: 'Walking, moderate pace', met: 3.5, kind: 'cardio' },
  { name: 'Walking, brisk', met: 4.3, kind: 'cardio' },
  { name: 'Hiking', met: 6.0, kind: 'cardio' },
  { name: 'Running, 5 mph (12 min/mile)', met: 8.3, kind: 'cardio' },
  { name: 'Running, 6 mph (10 min/mile)', met: 9.8, kind: 'cardio' },
  { name: 'Running, 7.5 mph (8 min/mile)', met: 11.8, kind: 'cardio' },
  { name: 'Cycling, leisurely', met: 4.0, kind: 'cardio' },
  { name: 'Cycling, moderate', met: 7.5, kind: 'cardio' },
  { name: 'Cycling, vigorous', met: 10.0, kind: 'cardio' },
  { name: 'Stationary bike, moderate', met: 6.8, kind: 'cardio' },
  { name: 'Swimming laps, moderate', met: 5.8, kind: 'cardio' },
  { name: 'Swimming laps, vigorous', met: 9.8, kind: 'cardio' },
  { name: 'Elliptical trainer', met: 5.0, kind: 'cardio' },
  { name: 'Rowing machine, moderate', met: 7.0, kind: 'cardio' },
  { name: 'Stair climbing', met: 8.8, kind: 'cardio' },
  { name: 'Jump rope', met: 11.8, kind: 'cardio' },
  { name: 'HIIT / circuit training', met: 8.0, kind: 'cardio' },
  { name: 'Aerobics / dance fitness', met: 6.5, kind: 'cardio' },
  { name: 'Yoga', met: 2.5, kind: 'cardio' },
  { name: 'Pilates', met: 3.0, kind: 'cardio' },
  { name: 'Basketball', met: 6.5, kind: 'cardio' },
  { name: 'Soccer', met: 7.0, kind: 'cardio' },
  { name: 'Tennis', met: 7.3, kind: 'cardio' },
  { name: 'Gardening / yard work', met: 3.8, kind: 'cardio' },
  { name: 'Strength training, moderate', met: 3.5, kind: 'strength' },
  { name: 'Strength training, vigorous', met: 6.0, kind: 'strength' },
  { name: 'Bodyweight exercises', met: 3.8, kind: 'strength' },
];

export function estimateBurn(met: number, weightKg: number, minutes: number): number {
  if (!(met > 0) || !(weightKg > 0) || !(minutes > 0)) return 0;
  return Math.round((met * weightKg * minutes) / 60);
}
