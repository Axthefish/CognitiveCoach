// Stream API test endpoint

export async function GET() {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      // 发送几条测试消息
      for (let i = 0; i < 5; i++) {
        const message = `data: ${JSON.stringify({ type: 'test', payload: `Message ${i + 1}` })}\n\n`;
        controller.enqueue(encoder.encode(message));
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // 发送完成消息
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', payload: null })}\n\n`));
      controller.close();
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
