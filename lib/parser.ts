/**
 * A fast, robust, dependency-free HTML parser using a single-pass
 * regular expression approach to extract media source URLs.
 * Optimized for performance on large HTML documents.
 */

type Media = {
    images: string[];
    audios: string[];
    videos: string[];
};

const IMAGE_EXTENSIONS = ['jpe?g', 'png', 'gif', 'webp', 'svg', 'bmp'];
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'aac', 'm4a'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'flv'];

/**
 * Parses a `srcset` attribute string to extract all unique URLs.
 * e.g., "cat-small.jpg 500w, cat-medium.jpg 1000w, cat-large.jpg 2000w"
 * -> ["cat-small.jpg", "cat-medium.jpg", "cat-large.jpg"]
 * @param srcsetValue The content of the srcset attribute.
 * @returns An array of URLs.
 */
const parseSrcset = (srcsetValue: string): string[] => {
    const sources = new Set<string>();
    srcsetValue.split(',').forEach(part => {
        const url = part.trim().split(/\s+/)[0];
        if (url) {
            sources.add(url);
        }
    });
    return Array.from(sources);
};

/**
 * The main export function that orchestrates the extraction for all media types.
 * It performs a single pass over the HTML string, matching multiple patterns
 * at once for maximum efficiency.
 * @param html The full HTML string of the page.
 * @returns A Media object containing arrays of unique image, audio, and video URLs.
 */
export const extractMedia = (html: string): Media => {
    const imageSources = new Set<string>();
    const audioSources = new Set<string>();
    const videoSources = new Set<string>();

    const extensionToSetMap: { [key: string]: Set<string> } = {};
    IMAGE_EXTENSIONS.forEach(ext => (extensionToSetMap[ext] = imageSources));
    AUDIO_EXTENSIONS.forEach(ext => (extensionToSetMap[ext] = audioSources));
    VIDEO_EXTENSIONS.forEach(ext => (extensionToSetMap[ext] = videoSources));

    const allExtensions = [...IMAGE_EXTENSIONS, ...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS];
    const extensionRegexFragment = allExtensions.join('|');

    // Pattern 1: Standard tags like <img>, <video>, <audio>, <source>
    // Catches src, data-src, poster, etc.
    const tagSrcPattern = `<(?:img|video|audio|source)[^>]+?(?:src|data-src|poster|data-lazy-src)\\s*=\\s*["']([^"']+)["']`;

    // Pattern 2: `srcset` attributes, which require special parsing.
    const srcsetPattern = `(?:srcset|data-srcset)\\s*=\\s*["']([^"']+)["']`;

    // Pattern 3: `<a>` tags linking directly to media files.
    const anchorPattern = `<a[^>]+?href\\s*=\\s*["']([^"']+\\.(${extensionRegexFragment}))["']`;

    // Pattern 4: Inline style attributes with `background-image: url(...)`.
    const stylePattern = `background-image:\\s*url\\((?:"|'|)?([^)"']+\\.(${IMAGE_EXTENSIONS.join('|')}))(?:"|'|)?\\)`;

    const combinedRegex = new RegExp(
        [tagSrcPattern, srcsetPattern, anchorPattern, stylePattern].join('|'),
        'gi'
    );

    let match;
    while ((match = combinedRegex.exec(html)) !== null) {
        // match[1] -> from tagSrcPattern
        // match[2] -> from srcsetPattern
        // match[3] -> from anchorPattern (full URL)
        // match[5] -> from stylePattern (full URL)

        if (match[2]) {
            const srcsetUrls = parseSrcset(match[2]);
            srcsetUrls.forEach(url => imageSources.add(url));
            continue;
        }

        const url = match[1] || match[3] || match[5];
        if (!url) continue;

        const extensionMatch = url.match(/\.([a-z0-9]+)$/i);
        if (extensionMatch) {
            const ext = extensionMatch[1].toLowerCase();
            for (const key in extensionToSetMap) {
                if (new RegExp(`^${key}$`).test(ext)) {
                    extensionToSetMap[key].add(url);
                    break;
                }
            }
        }
    }

    return {
        images: Array.from(imageSources),
        audios: Array.from(audioSources),
        videos: Array.from(videoSources),
    };
};