import { addonBuilder } from 'stremio-addon-sdk';
import { searchNyaa, filterAndSortTorrents, toStremioStream } from './nyaa-scraper.js';
import { resolveImdbToTitle, resolveKitsuToTitle } from './title-resolver.js';

// Alias pour les séries connues avec des noms alternatifs ou d'arcs spécifiques
const SERIES_ALIASES = {
    // Jujutsu Kaisen
    'Jujutsu Kaisen': [
        'Jujutsu Kaisen: Shimetsu Kaiyuu',
        'Jujutsu Kaisen Culling Game',
        'Jujutsu Kaisen 3rd Season',
        'Jujutsu Kaisen - Shimetsu Kaiyu'
    ],
    // Frieren
    'Frieren: Beyond Journey\'s End': ['Sousou no Frieren'],
    'Frieren': ['Sousou no Frieren'],
    // Demon Slayer
    'Demon Slayer: Kimetsu no Yaiba': ['Kimetsu no Yaiba', 'Demon Slayer'],
    'Demon Slayer': ['Kimetsu no Yaiba'],
    // Attack on Titan
    'Attack on Titan': ['Shingeki no Kyojin'],
    // Mushoku Tensei
    'Mushoku Tensei: Jobless Reincarnation': ['Mushoku Tensei'],
    // Re:Zero
    'Re:Zero - Starting Life in Another World': ['Re:Zero kara Hajimeru Isekai Seikatsu', 'Re:Zero']
};

// Addon manifest - configuration de l'addon
const manifest = {
    id: 'community.nyaa.scraper',
    version: '1.0.1',
    name: 'Nyaa.si Scraper',
    description: 'Stream anime torrents from nyaa.si with French subtitles',

    // Types de contenu supportés
    resources: ['stream'],
    types: ['movie', 'series'],

    // Catalogues (optionnel pour l'instant)
    catalogs: [],

    // Comportement de l'addon
    idPrefixes: ['tt', 'kitsu']
};

const builder = new addonBuilder(manifest);

// Handler pour les streams - appelé quand Stremio demande des sources
builder.defineStreamHandler(async (args) => {
    console.log(`[Nyaa Addon] Stream request for: ${args.type} - ${args.id}`);
    console.log(`[Nyaa Addon] Metadata:`, JSON.stringify(args, null, 2));

    try {
        const streams = await getStreamsForContent(args);

        console.log(`[Nyaa Addon] Returning ${streams.length} streams`);
        return { streams };
    } catch (error) {
        console.error('[Nyaa Addon] Error:', error);
        return { streams: [] };
    }
});

// Fonction pour obtenir les streams depuis nyaa.si
async function getStreamsForContent(args) {
    // Extraire le titre depuis les métadonnées Stremio ou résoudre l'ID
    let title = await extractTitle(args);

    if (!title) {
        console.log('[Nyaa Addon] No title found, skipping search');
        return [];
    }

    // Liste des recherches à effectuer
    let queries = [];

    // Si c'est une série, on génère plusieurs formats de recherche
    if (args.type === 'series' && args.id.includes(':')) {
        const parts = args.id.split(':');
        // args.id format: tt123456:season:episode
        const season = parseInt(parts[parts.length - 2], 10);
        const episode = parseInt(parts[parts.length - 1], 10);
        const epStr = episode.toString().padStart(2, '0');
        const seaStr = season.toString().padStart(2, '0');

        // 1. Format Standard: "Titre S03E01"
        queries.push(`${title} S${seaStr}E${epStr}`);

        // 2. Format Erai-raws / Saison Ordinal: "Titre 3rd Season - 01"
        const suffix = (n) => {
            const s = ["th", "st", "nd", "rd"];
            const v = n % 100;
            return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };
        const ordinal = suffix(season);
        queries.push(`${title} ${ordinal} Season - ${epStr}`);

        // 3. Format SubsPlease / Court: "Titre S3 - 01"
        queries.push(`${title} S${season} - ${epStr}`);

        // 4. Format Simple: "Titre - 01" (Peut retourner d'autres saisons, mais utile)
        queries.push(`${title} - ${epStr}`);

        // 5. Gestion des Alias
        const checkAlias = (key) => {
            if (SERIES_ALIASES[key]) {
                console.log(`[Nyaa Addon] Found aliases for "${key}"`);
                for (const alias of SERIES_ALIASES[key]) {
                    // "Alias 2nd Season - 01"
                    queries.push(`${alias} ${ordinal} Season - ${epStr}`);
                    // "Alias S02E01"
                    queries.push(`${alias} S${seaStr}E${epStr}`);
                    // "Alias - 01"
                    queries.push(`${alias} - ${epStr}`);
                }
            }
        };

        checkAlias(title);
        // Au cas où le titre contient des trucs en plus, on peut essayer de voir si une clé est contenue dedans
        Object.keys(SERIES_ALIASES).forEach(key => {
            if (title.includes(key) && title !== key) checkAlias(key);
        });

    } else {
        // C'est un film
        queries.push(title);

        // Alias pour les films aussi si besoin
        if (SERIES_ALIASES[title]) {
            for (const alias of SERIES_ALIASES[title]) {
                queries.push(alias);
            }
        }
    }

    console.log(`[Nyaa Addon] Generated ${queries.length} search queries:`, queries);

    let allTorrents = [];
    let seenMagnets = new Set();

    // Exécuter les recherches (en série pour ne pas spammer)
    for (const query of queries) {
        // Limite de sécurité
        if (allTorrents.length >= 30) break;

        console.log(`[Nyaa Addon] Searching nyaa.si for: "${query}"`);

        try {
            const results = await searchNyaa(query, {
                category: '1_2',  // Anime - English-translated
                filter: '0'       // 0 = No filter (plus large)
            });

            console.log(`[Nyaa Addon] Found ${results.length} results`);

            for (const torrent of results) {
                if (!seenMagnets.has(torrent.magnetLink)) {
                    allTorrents.push(torrent);
                    seenMagnets.add(torrent.magnetLink);
                }
            }

        } catch (error) {
            console.error(`[Nyaa Addon] Error searching for "${query}":`, error.message);
        }
    }

    console.log(`[Nyaa Addon] Total unique torrents found: ${allTorrents.length}`);

    // Filtrer et trier selon les préférences
    const filtered = filterAndSortTorrents(allTorrents, {
        requireFrenchSubs: true,
        preferredGroups: ['Erai-raws', 'erai-raws'],
        preferredQualities: ['1080p', '720p', '4k', '2160p'],
        maxResults: 20
    });

    console.log(`[Nyaa Addon] ${filtered.length} torrents after filtering (French subs only)`);

    // Convertir au format Stremio
    return filtered.map(toStremioStream);
}

/**
 * Extrait le titre depuis les métadonnées Stremio ou résout l'ID
 * @param {object} args - Arguments du stream handler
 * @returns {Promise<string|null>} Titre extrait ou null
 */
async function extractTitle(args) {
    // 1. Essayer d'abord les métadonnées Stremio (souvent le plus simple)
    if (args.name) return args.name;
    if (args.extra && args.extra.name) return args.extra.name;

    // 2. Résoudre l'ID via API externe
    console.log('[Nyaa Addon] No name in metadata, resolving ID via API...');

    if (args.id.startsWith('tt')) {
        // IMDb ID
        const title = await resolveImdbToTitle(args.id);
        if (title) return title;
    } else if (args.id.startsWith('kitsu:')) {
        // Kitsu ID
        const kitsuId = args.id.split(':')[1];
        const title = await resolveKitsuToTitle(kitsuId);
        if (title) return title;
    }

    // 3. Fallback: utiliser l'ID brut
    return null;
}

// Démarrer le serveur avec le SDK Stremio
import stremioSDK from 'stremio-addon-sdk';
const { addonBuilder: builderExport, serveHTTP } = stremioSDK;
const addonInterface = builder.getInterface();

const PORT = process.env.PORT || 7000;

serveHTTP(addonInterface, { port: PORT }).then(() => {
    console.log(`\n🚀 Nyaa.si Stremio Addon running on http://localhost:${PORT}`);
    console.log(`📦 Manifest: http://localhost:${PORT}/manifest.json`);
    console.log(`🔗 Install in Stremio: http://localhost:${PORT}/manifest.json\n`);
}).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
