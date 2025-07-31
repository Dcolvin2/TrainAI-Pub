export const workoutSchema = {
  name: "updateWorkout",
  description: "Create or modify the current workout plan",
  parameters: {
    type: "object",
    properties: {
      warmup:      { type:"array", items:{ type:"string" } },
      core_lift:   { type:"string",  nullable:true },
      accessories: { type:"array", items:{ type:"string" } },
      cooldown:    { type:"array", items:{ type:"string" } },
      minutes:     { type:"integer", description:"total workout length" }
    },
    required:["minutes","warmup","accessories","cooldown"]
  }
}; 