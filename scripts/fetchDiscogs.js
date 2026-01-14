import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERNAME = 'tomschoem';
// Folder 0 is "All" usually, or the default folder
const URL = `https://api.discogs.com/users/${USERNAME}/collection/folders/0/releases`;
const OUTPUT_FILE = path.join(__dirname, '../src/data/discogsData.json');

// Check for incremental mode (default: true)
const INCREMENTAL = process.argv[2] !== '--full';

// Discogs requires a User-Agent
const HEADERS = {
  'User-Agent': 'ThomasSchoemaeckerPersonalSite/1.0',
};

// Fetch full release details including tracklist
async function fetchReleaseDetails(releaseId) {
  try {
    const response = await axios.get(`https://api.discogs.com/releases/${releaseId}`, {
      headers: HEADERS
    });

    const release = response.data;

    // Extract tracklist - handle both simple and complex tracklists
    const tracklist = release.tracklist ? release.tracklist.map(track => ({
      position: track.position || '',
      title: track.title || '',
      duration: track.duration || '',
      type_: track.type_ || 'track', // track, index, heading, etc.
      // Include artist name if present (for tracks with featured artists or different performers)
      artist: track.artists && track.artists.length > 0 
        ? track.artists.map(a => a.name).join(', ')
        : null
    })) : [];

    return {
      tracklist,
      tracklist_count: tracklist.length
    };
  } catch (error) {
    // If release fetch fails, return empty tracklist
    if (error.response && error.response.status === 404) {
      console.warn(`  ⚠️  Release ${releaseId} not found (404)`);
    } else if (error.response && error.response.status === 429) {
      console.warn(`  ⚠️  Rate limited for release ${releaseId}, waiting longer...`);
      // Wait longer if rate limited
      await new Promise(resolve => setTimeout(resolve, 5000));
      return null; // Signal to retry
    } else {
      console.warn(`  ⚠️  Error fetching release ${releaseId}: ${error.response?.status || error.message}`);
    }
    return { tracklist: [], tracklist_count: 0 };
  }
}

async function fetchCollection() {
  const mode = INCREMENTAL ? 'INCREMENTAL' : 'FULL';
  console.log(`🔄 Mode: ${mode}`);
  console.log(`Fetching Discogs collection for user: ${USERNAME}...\n`);
  
  let existingData = [];
  let existingDataMap = new Map(); // Map by id for quick lookup
  
  // Load existing data if in incremental mode
  if (INCREMENTAL && fs.existsSync(OUTPUT_FILE)) {
    try {
      existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
      existingData.forEach(release => {
        existingDataMap.set(release.id, release);
      });
      console.log(`📦 Loaded ${existingData.length} existing releases`);
    } catch (error) {
      console.warn(`⚠️  Could not load existing data: ${error.message}`);
    }
  }
  
  let allReleases = [];
  let page = 1;
  let hasMore = true;

  try {
    // Step 1: Fetch all releases from collection
    while (hasMore) {
      console.log(`Fetching collection page ${page}...`);
      const response = await axios.get(URL, {
        headers: HEADERS,
        params: {
          page: page,
          per_page: 100, // Max allowed
          sort: 'added',
          sort_order: 'desc'
        }
      });

      const data = response.data;
      const releases = data.releases;

      if (releases.length === 0) {
        hasMore = false;
      } else {
        // Filter and map basic data to keep file size small
        const formatted = releases.map(item => ({
          id: item.id,
          instance_id: item.instance_id,
          title: item.basic_information.title,
          artists: item.basic_information.artists.map(a => a.name).join(', '),
          year: item.basic_information.year,
          genres: item.basic_information.genres,
          styles: item.basic_information.styles,
          cover_image: item.basic_information.thumb, // Use thumb for efficiency
          labels: item.basic_information.labels.map(l => l.name).join(', '),
          added: item.date_added
        }));

        allReleases = allReleases.concat(formatted);

        // Check pagination
        if (data.pagination && data.pagination.pages > page) {
          page++;
          // Respect rate limits (light sleep)
          await new Promise(resolve => setTimeout(resolve, 1500));
        } else {
          hasMore = false;
        }
      }
    }

    console.log(`\n✅ Total releases in collection: ${allReleases.length}`);
    
    // In incremental mode: merge with existing data, preserve enrichment data
    if (INCREMENTAL) {
      const newReleases = [];
      const releasesToUpdate = [];
      const currentIds = new Set(allReleases.map(r => r.id));
      
      // Find new releases and releases needing tracklist updates
      for (const release of allReleases) {
        const existing = existingDataMap.get(release.id);
        if (!existing) {
          // New release
          newReleases.push(release);
        } else {
          // Existing release - merge data, preserve enrichment
          const merged = {
            ...release,
            // Preserve album-level enrichment data
            spotify_id: existing.spotify_id,
            spotify_uri: existing.spotify_uri,
            spotify_url: existing.spotify_url,
            spotify_image: existing.spotify_image,
            spotify_popularity: existing.spotify_popularity,
            // Preserve tracklist if it exists (includes all track-level enrichment data)
            tracklist: existing.tracklist && existing.tracklist.length > 0 
              ? existing.tracklist 
              : null,
            tracklist_count: existing.tracklist_count || 0
          };
          
          // If tracklist is missing, mark for update
          if (!merged.tracklist || merged.tracklist.length === 0) {
            releasesToUpdate.push(merged);
          }
          
          allReleases[allReleases.indexOf(release)] = merged;
        }
      }
      
      // Remove albums that are no longer in collection
      const removedIds = [];
      for (const existing of existingData) {
        if (!currentIds.has(existing.id)) {
          removedIds.push(existing);
        }
      }
      
      if (newReleases.length > 0) {
        console.log(`\n🆕 Found ${newReleases.length} new release(s)`);
      }
      if (releasesToUpdate.length > 0) {
        console.log(`\n🔄 Found ${releasesToUpdate.length} release(s) missing tracklist data`);
      }
      if (removedIds.length > 0) {
        console.log(`\n🗑️  Found ${removedIds.length} release(s) removed from collection`);
      }
    }
    
    // Step 2: Fetch tracklists for releases that need them
    const releasesNeedingTracklist = INCREMENTAL
      ? allReleases.filter(r => !r.tracklist || r.tracklist.length === 0)
      : allReleases;
    
    if (releasesNeedingTracklist.length > 0) {
      console.log(`\n📀 Fetching tracklists for ${releasesNeedingTracklist.length} release(s)...`);
      console.log(`   (This may take a while due to rate limiting)\n`);

      for (let i = 0; i < releasesNeedingTracklist.length; i++) {
        const release = releasesNeedingTracklist[i];
        const progress = `[${i + 1}/${releasesNeedingTracklist.length}]`;

        console.log(`${progress} Fetching tracklist for: ${release.title} by ${release.artists}...`);

        let releaseDetails = await fetchReleaseDetails(release.id);

        // Retry once if rate limited
        if (releaseDetails === null) {
          releaseDetails = await fetchReleaseDetails(release.id);
        }

        if (releaseDetails) {
          release.tracklist = releaseDetails.tracklist;
          release.tracklist_count = releaseDetails.tracklist_count;
          console.log(`  ✓ Found ${releaseDetails.tracklist_count} tracks`);
        } else {
          release.tracklist = [];
          release.tracklist_count = 0;
          console.log(`  ✗ No tracklist available`);
        }

        // Rate limiting: Discogs allows 60 requests per minute for authenticated users
        // We'll be conservative and wait 1.2 seconds between requests (50 req/min)
        await new Promise(resolve => setTimeout(resolve, 1200));
      }

      console.log(`\n✅ Tracklist enrichment complete!`);
    } else {
      console.log(`\n✅ All releases already have tracklist data`);
    }

    // Ensure directory exists
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allReleases, null, 2));
    console.log(`\n💾 Data saved to ${OUTPUT_FILE}`);

  } catch (error) {
    console.error('Error fetching data:', error.response ? error.response.status : error.message);
    if (error.response && error.response.status === 404) {
      console.error("User or collection not found. Check privacy settings.");
    }
  }
}

fetchCollection();
