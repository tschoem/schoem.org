import axios from 'axios';
import 'dotenv/config';

const GETSONGBPM_API_KEY = process.env.GETSONGBPM_API_KEY;
const GETSONGBPM_BASE_URL = 'https://api.getsong.co';

if (!GETSONGBPM_API_KEY) {
    console.error('❌ Missing GetSongBPM API key!');
    console.error('Please set GETSONGBPM_API_KEY environment variable.');
    process.exit(1);
}

// Test with different tracks
const testCases = [
    { artist: 'Guts', track: 'Good Morning' },
    { artist: 'Rage Against The Machine', track: 'Killing In The Name' },
    { artist: 'The Beatles', track: 'Hey Jude' }
];

console.log('🔍 Testing GetSongBPM API...\n');
console.log(`API Key: ${GETSONGBPM_API_KEY.substring(0, 10)}...\n`);

for (const testCase of testCases) {
    const { artist: testArtist, track: testTrack } = testCase;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: "${testTrack}" by ${testArtist}`);
    console.log(`${'='.repeat(60)}`);
    
    // Test different search query formats
    const searchQueries = [
        `${testArtist} ${testTrack}`,
        `${testTrack} ${testArtist}`,
        testTrack
    ];
    
    for (const searchQuery of searchQueries) {
    console.log(`\n📡 Testing search query: "${searchQuery}"`);
    console.log(`   URL: ${GETSONGBPM_BASE_URL}/search/`);
    console.log(`   Params: api_key=${GETSONGBPM_API_KEY.substring(0, 10)}..., type=song, lookup=${searchQuery}`);
    
    try {
        const response = await axios.get(`${GETSONGBPM_BASE_URL}/search/`, {
            params: {
                api_key: GETSONGBPM_API_KEY,
                type: 'song',
                lookup: searchQuery
            }
        });
        
        console.log(`   ✅ Status: ${response.status}`);
        console.log(`   Response keys:`, Object.keys(response.data));
        console.log(`   Full response:`, JSON.stringify(response.data, null, 2));
        
        // Check response structure
        if (response.data.search) {
            if (response.data.search.error) {
                console.log(`   ⚠️  API returned error: ${response.data.search.error}`);
            } else if (response.data.search.song) {
                if (Array.isArray(response.data.search.song)) {
                    console.log(`   📊 Found ${response.data.search.song.length} songs`);
                    if (response.data.search.song.length > 0) {
                        console.log(`   First result:`, JSON.stringify(response.data.search.song[0], null, 2));
                    }
                } else {
                    console.log(`   📊 Single song object:`, JSON.stringify(response.data.search.song, null, 2));
                }
            } else {
                console.log(`   📊 Search object:`, JSON.stringify(response.data.search, null, 2));
            }
        } else if (response.data.song) {
            if (Array.isArray(response.data.song)) {
                console.log(`   📊 Found ${response.data.song.length} songs`);
                if (response.data.song.length > 0) {
                    console.log(`   First result:`, JSON.stringify(response.data.song[0], null, 2));
                }
            } else {
                console.log(`   📊 Single song object:`, JSON.stringify(response.data.song, null, 2));
            }
        } else {
            console.log(`   ⚠️  Unexpected response structure`);
        }
        
        if (response.data.search && !response.data.search.error) {
            console.log(`   ✅ SUCCESS! Found results with query: "${searchQuery}"`);
            break; // If successful, stop trying other formats
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.response?.status || error.message}`);
        if (error.response) {
            console.log(`   Status: ${error.response.status} ${error.response.statusText}`);
            console.log(`   Response data:`, JSON.stringify(error.response.data, null, 2));
        }
        if (error.request) {
            console.log(`   Request URL:`, error.config?.url);
            console.log(`   Request params:`, error.config?.params);
        }
    }
    
    // Wait between attempts
    await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

console.log(`\n💡 If all queries failed, check:`);
console.log(`   1. API key is valid`);
console.log(`   2. API endpoint structure is correct`);
console.log(`   3. Response format matches expectations`);
