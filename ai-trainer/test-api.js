// Simple test to verify the API is working
const { coreByDay, muscleMap, dayStringMap } = require('./lib/coreMap');

console.log("=== API TEST ===");

// Test the muscle mapping
const monday = dayStringMap["monday"];
const mondayCoreLift = coreByDay[monday];
const mondayMuscles = muscleMap[mondayCoreLift];

console.log("Monday test:");
console.log("- Day number:", monday);
console.log("- Core lift:", mondayCoreLift);
console.log("- Muscle targets:", mondayMuscles);

// Test API call (if running locally)
if (typeof fetch !== 'undefined') {
  console.log("\n=== TESTING API ===");
  
  fetch('/api/generateWorkout?debugDay=monday&durationMin=45', {
    headers: { 'x-user-id': 'test-user' }
  })
  .then(response => {
    console.log("Response status:", response.status);
    return response.json();
  })
  .then(data => {
    console.log("API Response:", data);
  })
  .catch(error => {
    console.error("API Error:", error);
  });
} else {
  console.log("\n=== SKIPPING API TEST (no fetch available) ===");
}

console.log("\n=== EXPECTED RESULTS ===");
console.log("✅ Monday should target: quads, glutes, hamstrings");
console.log("✅ API should return 200 status");
console.log("✅ Response should include accessories array"); 