/**
 * A simple, dependency-free HTML parser using regular expressions 
 * to extract media source URLs.
 */

// A type for the returned object, matching the one in App.tsx
type Media = {
    images: string[];
    audios: string[];
    videos: string[];
};

/**
 * Extracts all source URLs from a specific tag type in an HTML string.
 * It looks for both `src="..."` and `data-src="..."` attributes.
 * @param html The full HTML string of the page.
 * @param tag The name of the tag to search for (e.g., 'img', 'video').
 * @returns An array of unique source URLs.
 */
const extractSourcesByTag = (html: string, tag: string): string[] => {
    const sources = new Set<string>();

    // Regex to find tags with a `src` or `data-src` attribute.
    // Breakdown:
    // <${tag}        - Matches the opening tag, e.g., <img
    // [^>]+          - Matches one or more characters that are NOT the closing '>',
    //                  this allows us to scan through all attributes.
    // (?:src|data-src) - A non-capturing group to match either 'src' or 'data-src'.
    // \s*=\s*        - Matches the equals sign with optional whitespace.
    // ['"]           - Matches the opening single or double quote.
    // ([^'"]+)       - The capturing group! It captures everything until the next quote.
    //                  This is our URL.
    // ['"]           - Matches the closing quote.
    const regex = new RegExp(`<${tag}[^>]+(?:src|data-src)\\s*=\\s*['"]([^'"]+)['"]`, 'gi');

    let match;
    while ((match = regex.exec(html)) !== null) {
        if (match[1]) {
            sources.add(match[1]);
        }
    }

    return Array.from(sources);
};

/**
 * The main export function that orchestrates the extraction for all media types.
 * @param html The full HTML string of the page.
 * @returns A Media object containing arrays of image, audio, and video URLs.
 */
export const extractMedia = (html: string): Media => {
    return {
        images: extractSourcesByTag(html, 'img'),
        audios: extractSourcesByTag(html, 'audio'),
        videos: extractSourcesByTag(html, 'video'),
    };
};