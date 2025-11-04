// modules/analysis/scraper.js
const axios = require("axios");
const cheerio = require("cheerio");

/**
 * Fetches article content from a URL and returns the visible text.
 * @param {string} url - The article URL.
 * @returns {Promise<string|null>} - Scraped text or null if failed.
 */
async function scrapeArticle(url) {
  if (!url) return null;

  try {
    const { data: html } = await axios.get(url, {
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; NewsNexusBot/1.0; +https://cpsc.gov/)",
      },
    });

    const $ = cheerio.load(html);
    // Remove non-article junk
    $("script, style, nav, footer, header, form, noscript, svg").remove();

    // Get main visible text
    const text = $("body").text();
    const clean = text.replace(/\s+/g, " ").trim();

    // Truncate to keep prompt manageable
    const snippet =
      clean.length > 4000 ? clean.slice(0, 4000) + "..." : clean;

    return snippet || null;
  } catch (err) {
    console.warn(`⚠️ Failed to scrape ${url}:`, err.message);
    return null;
  }
}

module.exports = {
  scrapeArticle,
};