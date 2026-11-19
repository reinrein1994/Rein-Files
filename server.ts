import express from 'express';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {createServer as createViteServer} from 'vite';
import type {AppData, Place, PlaceInput, VoteRecord, VoteResults} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'camiguin-store.json');

interface StoreState {
  title: string;
  subtitle: string;
  places: Place[];
  votes: VoteRecord[];
}

const DEFAULT_PLACES: Place[] = [
  {
    id: 'bintana',
    name: 'Bintana Sa Paraiso',
    url: 'https://www.agoda.com/sh-app/1hD41KngMbT',
    location: 'Tangub, Naasag, Mambajao, Camiguin 9100',
    coordinates: {lat: '9.2450', lng: '124.6750'},
    rateForTwoNights: '₱9,000 – ₱17,000',
    rateNote: '2 nights · per room (approx. ₱4,500–₱8,500/night, breakfast included)',
    pax: '2 – 4 pax per room',
    amenities: [
      'Cliffside infinity pool overlooking the Bohol Sea',
      'Starlink high-speed Wi-Fi',
      'Josh + Luke on-site restaurant',
      'Daily breakfast & room service',
      'Natural hot spring access nearby',
      'Air-conditioning & private balcony',
    ],
    photos: [
      '/src/assets/images/bintana_cliffside_pool_1795052282139.jpg',
      '/src/assets/images/camiguin_villa_bedroom_1795052284349.jpg',
      '/src/assets/images/camiguin_dining_terrace_1795052284286.jpg',
    ],
  },
  {
    id: 'palermo',
    name: "Palermo's Islandville Villas",
    url: 'https://www.agoda.com/sh-app/N3wHEuH7w1m',
    location: 'Coastal Road, Catarman, Camiguin 9104',
    coordinates: {lat: '9.1325', lng: '124.6790'},
    rateForTwoNights: '₱7,000 – ₱11,600',
    rateNote: '2 nights · standard villa slot (full multi-bedroom group villa rates vary by season)',
    pax: 'Up to 22 – 24 pax (full villa)',
    amenities: [
      'Private outdoor swimming pool',
      'Direct beach shoreline access',
      'Outdoor kitchen & BBQ grilling area',
      'Air-conditioned multi-room layout',
      'Free private on-site parking',
      'Free Wi-Fi in common & villa areas',
    ],
    photos: [
      '/src/assets/images/palermo_islandville_villa_1795052282714.jpg',
      '/src/assets/images/camiguin_dining_terrace_1795052284286.jpg',
      '/src/assets/images/camiguin_villa_bedroom_1795052284349.jpg',
    ],
  },
  {
    id: 'puesta',
    name: 'Puesta del Sol Beach Bungalows and Restobar',
    url: 'https://www.agoda.com/sh-app/1QrYxP72umg',
    location: 'Barangay Yumbing, Mambajao, Camiguin 9100',
    coordinates: {lat: '9.2492', lng: '124.6619'},
    rateForTwoNights: '₱4,400 – ₱6,000',
    rateNote: '2 nights · per bungalow (approx. ₱2,200–₱3,000/night, near White Island jump-off)',
    pax: '2 – 4 pax per bungalow',
    amenities: [
      'Beachfront plunge pool & shoreline access',
      'In-house Mexican & Filipino Restobar',
      'Sunset rooftop terrace & lounge',
      'Air-conditioned bungalows with hot/cold shower',
      'Free parking & tour assistance',
      'Free Wi-Fi in public areas',
    ],
    photos: [
      '/src/assets/images/puesta_beach_bungalows_1795052283686.jpg',
      '/src/assets/images/camiguin_villa_bedroom_1795052284349.jpg',
      '/src/assets/images/camiguin_dining_terrace_1795052284286.jpg',
    ],
  },
  {
    id: 'playa',
    name: 'Playa del Fuego Camiguin Beach Hostel & Resort',
    url: 'https://www.agoda.com/sh-app/aCXjmSHU1Zi',
    location: 'Lower Banlas, Agoho, Mambajao, Camiguin 9100',
    coordinates: {lat: '9.2428', lng: '124.6695'},
    rateForTwoNights: '₱2,700 – ₱6,000',
    rateNote: '2 nights · double/deluxe bungalow (dorm beds from ₱1,300 for 2 nights)',
    pax: '2 – 8 pax per bungalow / dorm',
    amenities: [
      'Private volcanic black sand beachfront',
      'Beachfront bar & dining space',
      'Garden hammocks facing White Island',
      'Free resort-wide Wi-Fi',
      'Island tour & shuttle coordination',
      'Free on-site parking',
    ],
    photos: [
      '/src/assets/images/playa_fuego_beachfront_1795052283669.jpg',
      '/src/assets/images/camiguin_dining_terrace_1795052284286.jpg',
      '/src/assets/images/camiguin_villa_bedroom_1795052284349.jpg',
    ],
  },
  {
    id: 'mirasol',
    name: 'Mirasol Lodge Camiguin',
    url: 'https://www.agoda.com/sh-app/O6CKatsP3di',
    location: 'Balbagon, Mambajao, Camiguin 9100',
    coordinates: {lat: '9.2385', lng: '124.7322'},
    rateForTwoNights: '₱4,600 – ₱8,600',
    rateNote: '2 nights · whole lodge unit (approx. ₱2,300–₱4,300/night)',
    pax: '6 – 7 pax (whole lodge unit)',
    amenities: [
      'Air-conditioned rooms with twin & double beds',
      'Kitchen & basic meal prep area',
      'Private bathroom & spacious veranda',
      'Free Wi-Fi access',
      'Covered garage parking',
      'Pet-friendly family accommodation',
    ],
    photos: [
      '/src/assets/images/mirasol_lodge_camiguin_1795052285249.jpg',
      '/src/assets/images/camiguin_villa_bedroom_1795052284349.jpg',
      '/src/assets/images/camiguin_dining_terrace_1795052284286.jpg',
    ],
  },
];

const INITIAL_STATE: StoreState = {
  title: 'Grade 5 in Camiguin 2026',
  subtitle: 'Pick where we should stay — compare 2-night rates, locations, coordinates, and photos.',
  places: DEFAULT_PLACES,
  votes: [],
};

function ensureStore(): StoreState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {recursive: true});
  }
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(INITIAL_STATE, null, 2), 'utf-8');
    return structuredClone(INITIAL_STATE);
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoreState>;
    return {
      title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title : INITIAL_STATE.title,
      subtitle:
        typeof parsed.subtitle === 'string' && parsed.subtitle.trim()
          ? parsed.subtitle
          : INITIAL_STATE.subtitle,
      places: Array.isArray(parsed.places) && parsed.places.length > 0 ? parsed.places : structuredClone(DEFAULT_PLACES),
      votes: Array.isArray(parsed.votes) ? parsed.votes : [],
    };
  } catch {
    fs.writeFileSync(STORE_PATH, JSON.stringify(INITIAL_STATE, null, 2), 'utf-8');
    return structuredClone(INITIAL_STATE);
  }
}

function saveStore(state: StoreState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {recursive: true});
  }
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpPath, STORE_PATH);
}

function computeResults(places: Place[], votes: VoteRecord[]): VoteResults {
  const counts: Record<string, number> = {};
  const voters: Record<string, string[]> = {};
  places.forEach((p) => {
    counts[p.id] = 0;
    voters[p.id] = [];
  });
  let total = 0;
  votes.forEach((v) => {
    if (counts[v.placeId] !== undefined) {
      counts[v.placeId] += 1;
      voters[v.placeId].push(v.name);
      total += 1;
    }
  });
  return {counts, voters, total};
}

function buildAppData(state: StoreState): AppData {
  return {
    title: state.title,
    subtitle: state.subtitle,
    places: state.places,
    results: computeResults(state.places, state.votes),
  };
}

function sanitizePlaceInput(input: Partial<PlaceInput>, fallback?: Place): PlaceInput {
  const name = String(input.name ?? fallback?.name ?? '').trim().slice(0, 120);
  if (!name) {
    throw new Error('Place name is required.');
  }
  const location = String(input.location ?? fallback?.location ?? 'Camiguin, Philippines').trim().slice(0, 200);
  const lat = String(input.coordinates?.lat ?? fallback?.coordinates.lat ?? '9.2400').trim().slice(0, 32);
  const lng = String(input.coordinates?.lng ?? fallback?.coordinates.lng ?? '124.7000').trim().slice(0, 32);
  const rateForTwoNights = String(input.rateForTwoNights ?? fallback?.rateForTwoNights ?? 'Rate TBD')
    .trim()
    .slice(0, 100);
  const rateNote = String(input.rateNote ?? fallback?.rateNote ?? '2 nights stay estimate').trim().slice(0, 180);
  const pax = String(input.pax ?? fallback?.pax ?? '2 – 4 pax').trim().slice(0, 80);
  const url = String(input.url ?? fallback?.url ?? '').trim().slice(0, 500);

  const rawAmenities = Array.isArray(input.amenities) ? input.amenities : fallback?.amenities ?? [];
  const amenities = rawAmenities
    .map((a) => String(a).trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 20);

  const rawPhotos = Array.isArray(input.photos) ? input.photos : fallback?.photos ?? [];
  const photos = rawPhotos
    .map((p) => String(p).trim())
    .filter(Boolean)
    .slice(0, 10);

  return {
    name,
    url,
    location: location || 'Camiguin, Philippines',
    coordinates: {
      lat: lat || '9.2400',
      lng: lng || '124.7000',
    },
    rateForTwoNights: rateForTwoNights || 'Rate TBD',
    rateNote,
    pax: pax || '2 – 4 pax',
    amenities,
    photos:
      photos.length > 0
        ? photos
        : ['/src/assets/images/camiguin_villa_bedroom_1795052284349.jpg'],
  };
}

function slugifyId(name: string, existingIds: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 28) || 'place';
  let candidate = base;
  let counter = 2;
  while (existingIds.has(candidate)) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '6mb'}));

  app.get('/api/data', (_req, res) => {
    const state = ensureStore();
    res.json(buildAppData(state));
  });

  app.get('/api/my-vote', (req, res) => {
    const rawName = String(req.query.name ?? '').trim().toLowerCase();
    if (!rawName) {
      res.json({placeId: null});
      return;
    }
    const state = ensureStore();
    const match = state.votes.find((v) => v.name.toLowerCase() === rawName);
    const validPlace = match && state.places.some((p) => p.id === match.placeId);
    res.json({placeId: validPlace ? match.placeId : null});
  });

  app.post('/api/vote', (req, res) => {
    const name = String(req.body?.name ?? '').trim().slice(0, 60);
    const placeId = String(req.body?.placeId ?? '').trim();
    if (!name) {
      res.status(400).json({error: 'Please enter your name.'});
      return;
    }
    const state = ensureStore();
    const place = state.places.find((p) => p.id === placeId);
    if (!place) {
      res.status(400).json({error: 'Please choose a valid place first.'});
      return;
    }
    const existingIndex = state.votes.findIndex((v) => v.name.toLowerCase() === name.toLowerCase());
    const now = new Date().toISOString();
    let changed = false;
    if (existingIndex >= 0) {
      state.votes[existingIndex] = {
        name: state.votes[existingIndex].name,
        placeId: place.id,
        updatedAt: now,
      };
      changed = true;
    } else {
      state.votes.push({
        name,
        placeId: place.id,
        updatedAt: now,
      });
    }
    saveStore(state);
    res.json({results: computeResults(state.places, state.votes), changed});
  });

  app.put('/api/trip-info', (req, res) => {
    const state = ensureStore();
    const title = String(req.body?.title ?? '').trim().slice(0, 100);
    const subtitle = String(req.body?.subtitle ?? '').trim().slice(0, 200);
    if (title) state.title = title;
    if (subtitle) state.subtitle = subtitle;
    saveStore(state);
    res.json(buildAppData(state));
  });

  app.put('/api/places/:id', (req, res) => {
    const {id} = req.params;
    const state = ensureStore();
    const index = state.places.findIndex((p) => p.id === id);
    if (index < 0) {
      res.status(404).json({error: 'Place not found.'});
      return;
    }
    try {
      const sanitized = sanitizePlaceInput(req.body, state.places[index]);
      state.places[index] = {
        id: state.places[index].id,
        ...sanitized,
      };
      saveStore(state);
      res.json(buildAppData(state));
    } catch (err) {
      res.status(400).json({error: err instanceof Error ? err.message : 'Invalid place data.'});
    }
  });

  app.post('/api/places/:id/replace', (req, res) => {
    const {id} = req.params;
    const keepVotes = Boolean(req.body?.keepVotes);
    const state = ensureStore();
    const index = state.places.findIndex((p) => p.id === id);
    if (index < 0) {
      res.status(404).json({error: 'Place to replace was not found.'});
      return;
    }
    try {
      const sanitized = sanitizePlaceInput(req.body);
      const existingIds = new Set(state.places.map((p) => p.id));
      existingIds.delete(id);
      const newId = slugifyId(sanitized.name, existingIds);

      state.places[index] = {
        id: newId,
        ...sanitized,
      };

      if (keepVotes) {
        state.votes = state.votes.map((v) => (v.placeId === id ? {...v, placeId: newId} : v));
      } else {
        state.votes = state.votes.filter((v) => v.placeId !== id);
      }

      saveStore(state);
      res.json({data: buildAppData(state), newId});
    } catch (err) {
      res.status(400).json({error: err instanceof Error ? err.message : 'Invalid replacement data.'});
    }
  });

  app.post('/api/places', (req, res) => {
    const state = ensureStore();
    try {
      const sanitized = sanitizePlaceInput(req.body);
      const existingIds = new Set(state.places.map((p) => p.id));
      const newId = slugifyId(sanitized.name, existingIds);
      const newPlace: Place = {id: newId, ...sanitized};
      state.places.push(newPlace);
      saveStore(state);
      res.status(201).json({data: buildAppData(state), place: newPlace});
    } catch (err) {
      res.status(400).json({error: err instanceof Error ? err.message : 'Invalid place data.'});
    }
  });

  app.delete('/api/places/:id', (req, res) => {
    const {id} = req.params;
    const state = ensureStore();
    if (state.places.length <= 1) {
      res.status(400).json({error: 'At least one place must remain in the poll.'});
      return;
    }
    const nextPlaces = state.places.filter((p) => p.id !== id);
    if (nextPlaces.length === state.places.length) {
      res.status(404).json({error: 'Place not found.'});
      return;
    }
    state.places = nextPlaces;
    state.votes = state.votes.filter((v) => v.placeId !== id);
    saveStore(state);
    res.json(buildAppData(state));
  });

  app.post('/api/reset-defaults', (_req, res) => {
    const state = ensureStore();
    state.places = structuredClone(DEFAULT_PLACES);
    state.title = INITIAL_STATE.title;
    state.subtitle = INITIAL_STATE.subtitle;
    const validIds = new Set(state.places.map((p) => p.id));
    state.votes = state.votes.filter((v) => validIds.has(v.placeId));
    saveStore(state);
    res.json(buildAppData(state));
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Camiguin Stay Planner listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
