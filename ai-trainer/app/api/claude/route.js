export async function POST(request) {
  try {
    const { message } = await request.json();

    // For now, return a simplified response
    // Later we can integrate with real Claude API
    const response = {
      content: `Workout Plan for: ${message}\n\nThis is a placeholder response. Real Claude integration coming soon!`
    };

    return Response.json(response);
  } catch (error) {
    return Response.json({ error: 'Claude error' }, { status: 500 });
  }
} 