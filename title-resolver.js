import axios from 'axios';

// TMDB API - Clé personnelle de l'utilisateur
const TMDB_API_KEY = '0013483c84bb370e87a61513375019e4';

/**
 * Normalise un titre pour la recherche sur nyaa.si
 * Enlève les caractères spéciaux japonais et autres symboles
 * @param {string} title - Titre à normaliser
 * @returns {string} Titre normalisé
 */
function normalizeTitle(title) {
    if (!title) return '';

    return title
        // Enlever les brackets japonais 【】
        .replace(/【/g, '')
        .replace(/】/g, '')
        // Enlever autres brackets et parenthèses au début/fin
        .replace(/^\[|\]$/g, '')
        .replace(/^\(|\)$/g, '')
        // Enlever caractères spéciaux courants
        .replace(/[★☆♪♥]/g, '')
        // Nettoyer les espaces multiples
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Résout un ID IMDb en titre de film/série
 * @param {string} imdbId - ID IMDb (ex: tt21030032)
 * @returns {Promise<string|null>} Titre du contenu ou null
 */
export async function resolveImdbToTitle(imdbId) {
    try {
        // Nettoyer l'ID (enlever saison/épisode si présent)
        const cleanId = imdbId.split(':')[0];

        console.log(`[Title Resolver] Resolving IMDb ID: ${cleanId}`);

        // Utiliser l'API TMDB pour trouver le titre
        const response = await axios.get(`https://api.themoviedb.org/3/find/${cleanId}`, {
            params: {
                api_key: TMDB_API_KEY,
                external_source: 'imdb_id'
            },
            timeout: 5000
        });

        const data = response.data;

        // Chercher dans les résultats (peut être un film ou une série)
        let title = null;

        if (data.movie_results && data.movie_results.length > 0) {
            title = data.movie_results[0].title;
            console.log(`[Title Resolver] Found movie: ${title}`);
        } else if (data.tv_results && data.tv_results.length > 0) {
            title = data.tv_results[0].name;
            console.log(`[Title Resolver] Found TV show: ${title}`);
        }

        // Normaliser le titre
        if (title) {
            const normalized = normalizeTitle(title);
            console.log(`[Title Resolver] Normalized: "${title}" -> "${normalized}"`);
            return normalized;
        }

        return null;

    } catch (error) {
        console.error(`[Title Resolver] Error resolving ${imdbId}:`, error.message);
        return null;
    }
}

/**
 * Résout un ID Kitsu en titre
 * @param {string} kitsuId - ID Kitsu (ex: 12345)
 * @returns {Promise<string|null>} Titre du contenu ou null
 */
export async function resolveKitsuToTitle(kitsuId) {
    try {
        console.log(`[Title Resolver] Resolving Kitsu ID: ${kitsuId}`);

        const response = await axios.get(`https://kitsu.io/api/edge/anime/${kitsuId}`, {
            timeout: 5000
        });

        const title = response.data.data.attributes.titles.en ||
            response.data.data.attributes.titles.en_jp ||
            response.data.data.attributes.canonicalTitle;

        console.log(`[Title Resolver] Found anime: ${title}`);

        // Normaliser le titre
        const normalized = normalizeTitle(title);
        console.log(`[Title Resolver] Normalized: "${title}" -> "${normalized}"`);
        return normalized;

    } catch (error) {
        console.error(`[Title Resolver] Error resolving Kitsu ${kitsuId}:`, error.message);
        return null;
    }
}
