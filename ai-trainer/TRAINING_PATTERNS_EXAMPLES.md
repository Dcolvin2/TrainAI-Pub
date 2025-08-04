# Training Patterns API Examples

## 🎯 Available Training Patterns

### **PPL (Push/Pull/Legs)**
- **Sequence**: push → pull → legs → push → pull → legs → rest
- **Focus**: Split training by movement patterns
- **Best for**: Intermediate to advanced lifters

### **Upper/Lower**
- **Sequence**: upper → lower → rest → upper → lower → rest → rest
- **Focus**: Upper/lower body split
- **Best for**: Beginners to intermediate

### **Full Body**
- **Sequence**: full → rest → full → rest → full → rest → rest
- **Focus**: Full body compound movements
- **Best for**: Beginners, time-constrained lifters

### **Movement Patterns**
- **Sequence**: squat_push → hinge_pull → rest → squat_push → hinge_pull → rest → rest
- **Focus**: Movement pattern-based training
- **Best for**: Functional fitness enthusiasts

## 🚀 API Usage Examples

### **Basic Usage (No Training Pattern)**
```bash
# Monday - uses default core lift mapping
curl -H"x-user-id:<uid>" "http://localhost:3000/api/generateWorkout?debugDay=monday&durationMin=45"

# Thursday - uses default core lift mapping  
curl -H"x-user-id:<uid>" "http://localhost:3000/api/generateWorkout?debugDay=thursday&durationMin=30"
```

### **PPL Training Pattern**
```bash
# Monday (Push Day)
curl -H"x-user-id:<uid>" "http://localhost:3000/api/generateWorkout?debugDay=monday&trainingPattern=PPL&durationMin=45"

# Tuesday (Pull Day)
curl -H"x-user-id:<uid>" "http://localhost:3000/api/generateWorkout?debugDay=tuesday&trainingPattern=PPL&durationMin=45"

# Wednesday (Legs Day)
curl -H"x-user-id:<uid>" "http://localhost:3000/api/generateWorkout?debugDay=wednesday&trainingPattern=PPL&durationMin=45"
```

### **Upper/Lower Training Pattern**
```bash
# Monday (Upper Day)
curl -H"x-user-id:<uid>" "http://localhost:3000/api/generateWorkout?debugDay=monday&trainingPattern=UPPER_LOWER&durationMin=45"

# Tuesday (Lower Day)
curl -H"x-user-id:<uid>" "http://localhost:3000/api/generateWorkout?debugDay=tuesday&trainingPattern=UPPER_LOWER&durationMin=45"
```

### **Full Body Training Pattern**
```bash
# Monday (Full Body Day)
curl -H"x-user-id:<uid>" "http://localhost:3000/api/generateWorkout?debugDay=monday&trainingPattern=FULL_BODY&durationMin=45"

# Wednesday (Full Body Day)
curl -H"x-user-id:<uid>" "http://localhost:3000/api/generateWorkout?debugDay=wednesday&trainingPattern=FULL_BODY&durationMin=45"
```

### **Movement Patterns Training**
```bash
# Monday (Squat/Push Day)
curl -H"x-user-id:<uid>" "http://localhost:3000/api/generateWorkout?debugDay=monday&trainingPattern=MOVEMENT_PATTERNS&durationMin=45"

# Tuesday (Hinge/Pull Day)
curl -H"x-user-id:<uid>" "http://localhost:3000/api/generateWorkout?debugDay=tuesday&trainingPattern=MOVEMENT_PATTERNS&durationMin=45"
```

## 📊 Day Mapping Examples

### **PPL Pattern - Week 1**
| Day | Pattern Day | Core Lift | Focus |
|-----|-------------|-----------|-------|
| Monday | Push | Barbell Bench Press | Chest, Triceps, Shoulders |
| Tuesday | Pull | Barbell Deadlift | Back, Glutes, Hamstrings |
| Wednesday | Legs | Barbell Back Squat | Quads, Glutes, Hamstrings |
| Thursday | Push | Barbell Bench Press | Chest, Triceps, Shoulders |
| Friday | Pull | Barbell Deadlift | Back, Glutes, Hamstrings |
| Saturday | Legs | Barbell Back Squat | Quads, Glutes, Hamstrings |
| Sunday | Rest | Rest | Recovery |

### **Upper/Lower Pattern - Week 1**
| Day | Pattern Day | Core Lift | Focus |
|-----|-------------|-----------|-------|
| Monday | Upper | Barbell Bench Press | Chest, Triceps, Shoulders |
| Tuesday | Lower | Barbell Back Squat | Quads, Glutes, Hamstrings |
| Wednesday | Rest | Rest | Recovery |
| Thursday | Upper | Barbell Bench Press | Chest, Triceps, Shoulders |
| Friday | Lower | Barbell Back Squat | Quads, Glutes, Hamstrings |
| Saturday | Rest | Rest | Recovery |
| Sunday | Rest | Rest | Recovery |

### **Full Body Pattern - Week 1**
| Day | Pattern Day | Core Lift | Focus |
|-----|-------------|-----------|-------|
| Monday | Full | Barbell Back Squat | Full Body |
| Tuesday | Rest | Rest | Recovery |
| Wednesday | Full | Barbell Back Squat | Full Body |
| Thursday | Rest | Rest | Recovery |
| Friday | Full | Barbell Back Squat | Full Body |
| Saturday | Rest | Rest | Recovery |
| Sunday | Rest | Rest | Recovery |

## 🎯 Response Examples

### **PPL Push Day Response**
```json
{
  "warmup": [
    {"name": "Light Cardio", "duration": "2 min"},
    {"name": "Dynamic Stretches", "duration": "2 min"},
    {"name": "Movement Prep", "duration": "1 min"}
  ],
  "main": [
    {"name": "Barbell Bench Press", "sets": 4, "reps": "6-8"}
  ],
  "accessories": [
    {"name": "Dumbbell Flyes", "sets": 3, "reps": "10-12"},
    {"name": "Parallel Bar Dips", "sets": 3, "reps": "8-10"},
    {"name": "Barbell Overhead Press", "sets": 3, "reps": "8-10"}
  ],
  "cooldown": [
    {"name": "Light Stretching", "duration": "2 min"},
    {"name": "Deep Breathing", "duration": "1 min"},
    {"name": "Cool Down Walk", "duration": "1 min"}
  ],
  "duration": 45,
  "focus": "chest",
  "trainingPattern": "PPL"
}
```

### **Upper/Lower Lower Day Response**
```json
{
  "warmup": [
    {"name": "Light Cardio", "duration": "2 min"},
    {"name": "Dynamic Stretches", "duration": "2 min"},
    {"name": "Movement Prep", "duration": "1 min"}
  ],
  "main": [
    {"name": "Barbell Back Squat", "sets": 4, "reps": "6-8"}
  ],
  "accessories": [
    {"name": "Barbell Front Squat", "sets": 3, "reps": "8-10"},
    {"name": "Walking Lunges", "sets": 3, "reps": "10-12"},
    {"name": "Box Step-Up", "sets": 3, "reps": "10-12"}
  ],
  "cooldown": [
    {"name": "Light Stretching", "duration": "2 min"},
    {"name": "Deep Breathing", "duration": "1 min"},
    {"name": "Cool Down Walk", "duration": "1 min"}
  ],
  "duration": 45,
  "focus": "quads",
  "trainingPattern": "UPPER_LOWER"
}
```

## 🔧 Integration with Exercise Database

The training patterns system integrates seamlessly with the comprehensive exercise database:

### **Equipment Filtering**
- Only exercises matching user's available equipment are selected
- Equipment requirements are checked against user's inventory
- Fallback to bodyweight exercises when needed

### **Muscle Targeting**
- Exercises are selected based on target muscle groups
- Synergist muscles are considered for accessory work
- Movement patterns align with training methodology

### **Rest Periods**
- Default rest periods from exercise database are used
- Training pattern influences rest timing
- Intensity levels are adjusted based on pattern

## 🎯 Benefits

### **✅ Structured Progression**
- Consistent training patterns over time
- Systematic muscle group targeting
- Progressive overload opportunities

### **✅ Flexibility**
- Multiple training pattern options
- Equipment-aware exercise selection
- Duration customization

### **✅ Personalization**
- User equipment integration
- Individual rest preferences
- Customizable workout length

### **✅ Scientific Approach**
- Evidence-based training patterns
- Proper exercise progression
- Balanced muscle development

## 🚀 Next Steps

1. **User Preference Storage**: Save user's preferred training pattern
2. **Progressive Overload**: Track weights and progress over time
3. **Exercise Variation**: Rotate exercises within patterns
4. **Recovery Monitoring**: Track rest day effectiveness
5. **Performance Analytics**: Measure pattern-specific progress

This system provides a comprehensive, flexible approach to workout generation that adapts to different training philosophies while maintaining scientific principles! 🏋️‍♂️ 