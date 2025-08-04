// Test script to verify muscle targeting and accessory exercise selection
const { coreByDay, muscleMap, dayStringMap } = require('./lib/coreMap');

console.log("=== MUSCLE TARGETING TEST ===");

// Test Monday (should be leg day)
const monday = dayStringMap["monday"];
const mondayCoreLift = coreByDay[monday];
const mondayMuscles = muscleMap[mondayCoreLift];

console.log("Monday test:");
console.log("- Day number:", monday);
console.log("- Core lift:", mondayCoreLift);
console.log("- Muscle targets:", mondayMuscles);

// Test Tuesday (should be chest day)
const tuesday = dayStringMap["tuesday"];
const tuesdayCoreLift = coreByDay[tuesday];
const tuesdayMuscles = muscleMap[tuesdayCoreLift];

console.log("\nTuesday test:");
console.log("- Day number:", tuesday);
console.log("- Core lift:", tuesdayCoreLift);
console.log("- Muscle targets:", tuesdayMuscles);

// Test Saturday (should be deadlift day)
const saturday = dayStringMap["saturday"];
const saturdayCoreLift = coreByDay[saturday];
const saturdayMuscles = muscleMap[saturdayCoreLift];

console.log("\nSaturday test:");
console.log("- Day number:", saturday);
console.log("- Core lift:", saturdayCoreLift);
console.log("- Muscle targets:", saturdayMuscles);

console.log("\n=== EXPECTED RESULTS ===");
console.log("✅ Monday should target: quads, glutes, hamstrings");
console.log("✅ Tuesday should target: chest, triceps, shoulders");
console.log("✅ Saturday should target: glutes, hamstrings, back");

console.log("\n=== ACTUAL RESULTS ===");
console.log(`Monday: ${mondayMuscles?.join(", ") || "❌ EMPTY"}`);
console.log(`Tuesday: ${tuesdayMuscles?.join(", ") || "❌ EMPTY"}`);
console.log(`Saturday: ${saturdayMuscles?.join(", ") || "❌ EMPTY"}`); 