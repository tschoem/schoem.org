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
      type_: track.type_ || 'track' // track, index, heading, etc.
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
  console.log(`Fetching Discogs collection for user: ${USERNAME}...`);
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

    console.log(`\n✅ Total releases fetched: ${allReleases.length}`);
    console.log(`\n📀 Fetching tracklists for each release...`);
    console.log(`   (This may take a while due to rate limiting)\n`);

    // Step 2: Fetch tracklists for each release
    for (let i = 0; i < allReleases.length; i++) {
      const release = allReleases[i];
      const progress = `[${i + 1}/${allReleases.length}]`;

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
