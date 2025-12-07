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

async function fetchCollection() {
    console.log(`Fetching Discogs collection for user: ${USERNAME}...`);
    let allReleases = [];
    let page = 1;
    let hasMore = true;

    try {
        while (hasMore) {
            console.log(`Fetching page ${page}...`);
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

        console.log(`Total releases fetched: ${allReleases.length}`);

        // Ensure directory exists
        const dir = path.dirname(OUTPUT_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allReleases, null, 2));
        console.log(`Data saved to ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('Error fetching data:', error.response ? error.response.status : error.message);
        if (error.response && error.response.status === 404) {
            console.error("User or collection not found. Check privacy settings.");
        }
    }
}

fetchCollection();
