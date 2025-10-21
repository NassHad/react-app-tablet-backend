const { extractRef } = require('./import-wiper-data');

// Test data from the CSV
const testCases = [
  {
    description: "VALEO BALAI E.G. ARRIERE VS01 240MM",
    brand: "VALEO",
    gtiCode: "906000",
    expected: "VS01"
  },
  {
    description: "VALEO BALAI E.G. STD VS35 530MM",
    brand: "VALEO", 
    gtiCode: "906190",
    expected: "VS35"
  },
  {
    description: "VALEO KIT BALAI E.G. PLAT ORIG. VS90 680+425MM - PSA 3008 II, 5008 II",
    brand: "VALEO",
    gtiCode: "906430",
    expected: "VS90"
  },
  {
    description: "VALEO KIT BALAI E.G. PLAT ORIGINE VS91 700+300MM RENAULT Clio V",
    brand: "VALEO",
    gtiCode: "906440",
    expected: "VS91"
  },
  {
    description: "VALEO KIT BALAI E.G. PLAT ORIGINE VS92 650+350MM RENAULT Captur 1",
    brand: "VALEO",
    gtiCode: "906450",
    expected: "VS92"
  },
  {
    description: "BEG PLAT 350MM 14 pouces",
    brand: "IMDICAR",
    gtiCode: "480",
    expected: "14 pouces"
  },
  {
    description: "BEG PLAT 500MM 20 pouces",
    brand: "IMDICAR",
    gtiCode: "484",
    expected: "20 pouces"
  },
  {
    description: "BEG PLAT 700MM 28 pouces",
    brand: "IMDICAR",
    gtiCode: "489",
    expected: "28 pouces"
  }
];

console.log('🧪 Testing ref extraction logic...\n');

testCases.forEach((testCase, index) => {
  const result = extractRef(testCase.description, testCase.brand, testCase.gtiCode);
  const isCorrect = result === testCase.expected;
  
  console.log(`Test ${index + 1}:`);
  console.log(`   Description: ${testCase.description}`);
  console.log(`   Brand: ${testCase.brand}`);
  console.log(`   GTI Code: ${testCase.gtiCode}`);
  console.log(`   Expected: ${testCase.expected}`);
  console.log(`   Got: ${result}`);
  console.log(`   Result: ${isCorrect ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');
});

console.log('📊 Test completed!');
