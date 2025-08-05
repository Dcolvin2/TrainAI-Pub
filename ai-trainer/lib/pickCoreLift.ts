type Equip = string[];

const has = (equip: Equip, keyword: string) =>
  equip.some(e => e.toLowerCase().includes(keyword));

export function pickCoreLift(focus: string, equip: Equip) {
  switch (focus) {
    case 'legs':
      if (has(equip, 'barbell'))  return 'Barbell Back Squat';
      if (has(equip, 'kettlebell')) return 'Kettlebell Goblet Squat';
      if (has(equip, 'dumbbell')) return 'Dumbbell Goblet Squat';
      return 'Bodyweight Walking Lunge';

    case 'back':
    case 'pull':
      if (has(equip, 'trap bar')) return 'Trap Bar Deadlift';
      if (has(equip, 'barbell'))  return 'Barbell Deadlift';
      return 'Kettlebell Deadlift';

    case 'chest':
    case 'push':
      if (has(equip, 'barbell'))  return 'Barbell Bench Press';
      if (has(equip, 'dumbbell')) return 'Dumbbell Bench Press';
      return 'Ring Push-Up';

    default:
      return null;            // let GPT choose for non-mapped foci
  }
} 