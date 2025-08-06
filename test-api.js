// Test script for the Coach API
async function testCoachAPI() {
  const apiUrl = 'https://axthefish-cognitive-coach.vercel.app/api/coach';
  
  const testPayload = {
    action: 'refineGoal',
    payload: {
      userInput: '我想学习机器学习',
      conversationHistory: []
    }
  };

  console.log('Testing Coach API...');
  console.log('URL:', apiUrl);
  console.log('Payload:', JSON.stringify(testPayload, null, 2));
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    console.log('\nResponse Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('\nResponse Data:', JSON.stringify(data, null, 2));
    
    if (response.status === 500) {
      console.error('\n❌ ERROR: Server returned 500');
      if (data.error) {
        console.error('Error message:', data.error);
      }
      if (data.details) {
        console.error('Error details:', data.details);
      }
    } else if (response.status === 200) {
      console.log('\n✅ SUCCESS: API is working correctly');
    }
  } catch (error) {
    console.error('\n❌ FETCH ERROR:', error.message);
  }
}

testCoachAPI();