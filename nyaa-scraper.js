import axios from 'axios';
import * as cheerio from 'cheerio';

const NYAA_BASE_URL = 'https://nyaa.si';

/**
 * Recherche des torrents sur nyaa.si
 * @param {string} query - Terme de recherche
 * @param {object} options - Options de recherche (catégorie, filtre, etc.)
 * @returns {Promise<Array>} Liste des torrents trouvés
 */
export async function searchNyaa(query, options = {}) {
    try {
        const {
            category = '0_0',  // 0_0 = All categories, 1_2 = Anime - English-translated
            filter = '0',      // 0 = No filter, 1 = No remakes, 2 = Trusted only
            sort = 'seeders',  // seeders, size, date, downloads
            order = 'desc'     // desc, asc
        } = options;

        // Construire l'URL de recherche
        const searchUrl = `${NYAA_BASE_URL}/?f=${filter}&c=${category}&q=${encodeURIComponent(query)}&s=${sort}&o=${order}`;

        console.log(`[Nyaa Scraper] Searching: ${searchUrl}`);

        // Faire la requête HTTP avec des headers complets pour éviter le blocage
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Referer': 'https://nyaa.si/',
                'Cache-Control': 'max-age=0',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-User': '?1'
            },
            timeout: 15000 // 15 secondes timeout
        });

        // Parser le HTML avec cheerio
        const $ = cheerio.load(response.data);
        const torrents = [];

        // Extraire les résultats de la table
        $('tbody tr').each((index, element) => {
            const $row = $(element);

            // Extraire les informations
            const category = $row.find('td:nth-child(1) a').attr('title') || '';
            const title = $row.find('td:nth-child(2) a:not(.comments)').last().text().trim();
            const link = $row.find('td:nth-child(2) a:not(.comments)').last().attr('href');
            const magnetLink = $row.find('td:nth-child(3) a[href^="magnet:"]').attr('href');
            const size = $row.find('td:nth-child(4)').text().trim();
            const date = $row.find('td:nth-child(5)').text().trim();
            const seeders = parseInt($row.find('td:nth-child(6)').text().trim()) || 0;
            const leechers = parseInt($row.find('td:nth-child(7)').text().trim()) || 0;
            const downloads = parseInt($row.find('td:nth-child(8)').text().trim()) || 0;

            // Ajouter seulement si on a un magnet link
            if (magnetLink && title) {
                torrents.push({
                    title,
                    category,
                    link: NYAA_BASE_URL + link,
                    magnetLink,
                    size,
                    date,
                    seeders,
                    leechers,
                    downloads
                });
            }
        });

        console.log(`[Nyaa Scraper] Found ${torrents.length} torrents`);
        return torrents;

    } catch (error) {
        console.error('[Nyaa Scraper] Error:', error.message);
        throw error;
    }
}

/**
 * Détecte si un torrent a des sous-titres français
 * @param {string} title - Titre du torrent
 * @returns {boolean} True si sous-titres français détectés
 */
export function hasFrenchSubtitles(title) {
    const titleLower = title.toLowerCase();

    // Mots-clés pour sous-titres français
    const frenchKeywords = [
        'vostfr',
        'french',
        'français',
        'francais',
        'multisub',
        'multi-sub',
        'multi sub',
        'multi-subs',
        'multisubs'
    ];

    return frenchKeywords.some(keyword => titleLower.includes(keyword));
}

/**
 * Extrait la qualité vidéo du titre
 * @param {string} title - Titre du torrent
 * @returns {string|null} Qualité détectée (1080p, 720p, etc.) ou null
 */
export function extractQuality(title) {
    const qualityMatch = title.match(/(\d{3,4}p)/i);
    return qualityMatch ? qualityMatch[1].toLowerCase() : null;
}

/**
 * Détecte le release group
 * @param {string} title - Titre du torrent
 * @returns {string|null} Nom du release group ou null
 */
export function extractReleaseGroup(title) {
    // Format typique: [GroupName] Titre...
    const groupMatch = title.match(/^\[([^\]]+)\]/);
    return groupMatch ? groupMatch[1] : null;
}

/**
 * Filtre et trie les torrents selon les préférences
 * @param {Array} torrents - Liste des torrents
 * @param {object} preferences - Préférences de filtrage
 * @returns {Array} Torrents filtrés et triés
 */
export function filterAndSortTorrents(torrents, preferences = {}) {
    const {
        requireFrenchSubs = true,
        preferredGroups = ['Erai-raws', 'erai-raws'],
        preferredQualities = ['1080p', '720p'],
        maxResults = 15
    } = preferences;

    let filtered = torrents;

    // Filtrer par sous-titres français si requis
    // (Cette étape est maintenant plus souple, on peut vouloir voir les autres avec une croix rouge)
    // Mais pour l'instant gardons le filtre strict si demandé, sinon on affiche tout
    // Je vais modifier pour afficher tout mais trier le FR en premier

    // Ajouter des métadonnées enrichies
    filtered = filtered.map(torrent => {
        const { isFrench, flags } = extractLanguageInfo(torrent.title);
        return {
            ...torrent,
            quality: extractQuality(torrent.title),
            releaseGroup: extractReleaseGroup(torrent.title),
            isFrench,
            flags
        };
    });

    // Si onlyFrench, on filtre
    if (requireFrenchSubs) {
        // Optionnel : tu peux commenter cette ligne si tu veux voir les résultats non-FR avec une croix rouge
        filtered = filtered.filter(t => t.isFrench);
    }

    // Trier par priorité
    filtered.sort((a, b) => {
        // 0. Priorité absolue aux sous-titres FR (si on mélange)
        if (a.isFrench && !b.isFrench) return -1;
        if (!a.isFrench && b.isFrench) return 1;

        // 1. Priorité au release group préféré
        const aHasPreferredGroup = preferredGroups.some(g =>
            a.releaseGroup?.toLowerCase() === g.toLowerCase()
        );
        const bHasPreferredGroup = preferredGroups.some(g =>
            b.releaseGroup?.toLowerCase() === g.toLowerCase()
        );

        if (aHasPreferredGroup && !bHasPreferredGroup) return -1;
        if (!aHasPreferredGroup && bHasPreferredGroup) return 1;

        // 2. Priorité à la qualité préférée
        const aQualityIndex = preferredQualities.indexOf(a.quality);
        const bQualityIndex = preferredQualities.indexOf(b.quality);

        if (aQualityIndex !== -1 && bQualityIndex !== -1) {
            if (aQualityIndex < bQualityIndex) return -1;
            if (aQualityIndex > bQualityIndex) return 1;
        } else if (aQualityIndex !== -1) return -1;
        else if (bQualityIndex !== -1) return 1;

        // 3. Nombre de seeders (plus = mieux)
        return b.seeders - a.seeders;
    });

    return filtered.slice(0, maxResults);
}

/**
 * Extrait les infos de langue et sous-titres
 * @param {string} title - Titre du torrent
 * @returns {object} { isFrench: boolean, flags: string }
 */
function extractLanguageInfo(title) {
    const lowerTitle = title.toLowerCase();
    const isFrench = hasFrenchSubtitles(title);
    const isMulti = lowerTitle.includes('multi');
    const isDual = lowerTitle.includes('dual');

    let flags = '';

    if (isFrench) {
        flags += '🇫🇷';
        if (isMulti || isDual) flags += '🇯🇵'; // Souvent Multi = JP + FR
    } else {
        flags += '🇬🇧'; // Par défaut anglais sur nyaa
        if (lowerTitle.includes('jpn') || lowerTitle.includes('japanese')) flags += '🇯🇵';
    }

    return { isFrench, flags };
}

/**
 * Convertit un résultat nyaa.si en format Stremio stream
 * @param {object} torrent - Objet torrent depuis searchNyaa
 * @returns {object} Stream formaté pour Stremio
 */
export function toStremioStream(torrent) {
    const quality = torrent.quality || extractQuality(torrent.title) || '';
    const group = torrent.releaseGroup || extractReleaseGroup(torrent.title) || '';
    // isFrench et flags sont déjà calculés dans filterAndSortTorrents mais on recalcul au cas où
    const { isFrench, flags } = torrent.flags ? torrent : extractLanguageInfo(torrent.title);

    // Titre formaté: [Group] 1080p 🇫🇷 👤 123 | 1.4 GB
    let displayTitle = '';

    if (group) displayTitle += `[${group}] `;
    if (quality) displayTitle += `${quality} `;

    displayTitle += `${flags} `;

    // Si pas de FR, on met une croix rouge pour alerter (si le filtre n'est pas strict)
    if (!isFrench) {
        displayTitle += '❌ ';
    }

    displayTitle += `👤 ${torrent.seeders} | 💾 ${torrent.size}`;

    return {
        name: 'Nyaa.si', // Garder un nom court pour la colonne de gauche
        title: displayTitle,
        url: torrent.magnetLink,

        // Métadonnées pour le tri
        behaviorHints: {
            bingeGroup: 'nyaa-' + (group || 'default')
        }
    };
}
