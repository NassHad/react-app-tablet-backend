// Minimal test to debug fetch issue

async function test() {
  try {
    console.log('Test 1: Simple fetch');
    const response1 = await fetch('http://localhost:1338/api/brands');
    const data1 = await response1.json();
    console.log('✅ Success! Found', data1.data.length, 'brands');

    console.log('\nTest 2: Fetch with pagination query');
    const response2 = await fetch('http://localhost:1338/api/brands?pagination[limit]=100');
    const data2 = await response2.json();
    console.log('✅ Success! Found', data2.data.length, 'brands');

    console.log('\nTest 3: Multiple sequential fetches');
    for (let i = 0; i < 3; i++) {
      const response = await fetch('http://localhost:1338/api/brands');
      const data = await response.json();
      console.log(`✅ Fetch ${i + 1}: Found`, data.data.length, 'brands');
    }

    console.log('\n✅ All tests passed!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Cause:', err.cause);
  }
}

test();
