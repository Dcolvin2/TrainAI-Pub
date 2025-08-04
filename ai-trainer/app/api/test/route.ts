import { NextRequest, NextResponse } from 'next/server';
import { coreByDay, muscleMap, dayStringMap } from "@/lib/coreMap";

export async function GET(req: NextRequest) {
  try {
    const debugDay = req.nextUrl.searchParams.get("debugDay") || "monday";
    
    console.log("[TEST] API called with debugDay:", debugDay);
    
    // Handle day parameter
    const dayLower = debugDay.toLowerCase();
    let weekday: number;
    
    if (dayStringMap[dayLower]) {
      weekday = dayStringMap[dayLower];
    } else {
      const numericDay = Number(debugDay);
      if (isNaN(numericDay) || numericDay < 0 || numericDay > 6) {
        return NextResponse.json({ 
          error: "Invalid day parameter" 
        }, { status: 400 });
      }
      weekday = numericDay;
    }

    // Get core lift and muscle targets
    const coreLift = coreByDay[weekday];
    const muscleTargets = muscleMap[coreLift] || [];

    console.log("[TEST] Results:", {
      weekday,
      dayName: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][weekday],
      coreLift,
      muscleTargets
    });

    return NextResponse.json({
      success: true,
      weekday,
      dayName: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][weekday],
      coreLift,
      muscleTargets,
      availableMappings: Object.keys(muscleMap)
    });

  } catch (error) {
    console.error('[TEST] Error:', error);
    return NextResponse.json({ 
      error: "Test failed", 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 