export async function POST(request) {
  try {
    const { message } = await request.json();

    // Simplified response without external API call
    const response = {
      content: `Echo: ${message} (API temporarily simplified)`
    };

    return Response.json(response);
  } catch (error) {
    return Response.json({ error: 'Claude error' }, { status: 500 });
  }
} 