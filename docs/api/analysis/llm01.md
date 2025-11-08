# API Reference - News Nexus API 09 LLM Analysis

This document provides comprehensive documentation for all LLM analysis endpoints in the News Nexus API 09 service.

## LLM Analysis Endpoints

All LLM analysis endpoints are prefixed with `/analysis/llm01` and use OpenAI's GPT models to analyze articles for consumer product safety hazards.

### POST /analysis/llm01/:articleId

Analyzes a news article using OpenAI's GPT-4o-mini model to determine if it describes consumer product safety hazards in the United States. The endpoint scrapes article content from the URL, applies a prompt template with the scraped content, sends it to OpenAI, saves the parsed response to the database, and optionally saves the raw response to a JSON file.

**Authentication:** Required (JWT token)

**URL Parameters:**

- `articleId` (integer, required): The ID of the article to analyze

**Description:**

This endpoint performs comprehensive AI-powered analysis of news articles to identify consumer product safety hazards. It scrapes the full article content from the source URL, uses a structured prompt template, analyzes the content with OpenAI, and stores the results in a structured database format.

**Process Flow:**

1. Retrieves article (title, description, url) from the database using the provided articleId
2. Attempts to scrape full article content from the article URL:
   - Uses cheerio to parse HTML and extract visible text
   - Removes non-article elements (scripts, nav, footer, etc.)
   - Truncates to 4000 characters maximum
   - Gracefully handles failures (continues with analysis even if scraping fails)
3. Reads the prompt template from `src/templates/prompt-markdown/prompt02.md`
4. Replaces placeholders with article data:
   - `<< ARTICLE_TITLE >>` → article title
   - `<< ARTICLE_DESCRIPTION >>` → article description
   - `<< ARTICLE_SCRAPED_CONTENT >>` → scraped content (if successful)
   - If scraping fails, removes entire "Article Content" section from prompt
5. Sends the completed prompt to OpenAI's GPT-4o-mini model with:
   - Temperature: 0 (deterministic responses)
   - Max tokens: 100 (concise responses)
6. Parses the JSON response from OpenAI and saves to database:
   - Looks up "Open AI 4o mini API" entity in ArtificialIntelligences table
   - Gets associated EntityWhoCategorizedArticle ID
   - Deletes existing records for this article + entity combination
   - Creates new records in ArticleEntityWhoCategorizedArticleContracts02 for each key-value pair
   - Stores scrapingStatus ("success" or "fail") as an additional record
7. Optionally saves the full OpenAI API response to `{PATH_PROJECT_RESOURCES}/llm-01/responses/{articleId}_{timestamp}.json`
8. Returns comprehensive response with AI data, database stats, scraping info, and file status

**Response (200 OK - Success with Scraping):**

```json
{
  "result": true,
  "message": "Successfully processed article with OpenAI and saved to database",
  "aiResponse": {
    "id": "chatcmpl-123",
    "object": "chat.completion",
    "created": 1677652288,
    "model": "gpt-4o-mini",
    "choices": [
      {
        "index": 0,
        "message": {
          "role": "assistant",
          "content": "{\"product\":\"electric scooter\",\"state\":\"California\",\"hazard\":\"fire\",\"relevance_score\":9,\"united_states_score\":10}"
        },
        "finish_reason": "stop"
      }
    ],
    "usage": {
      "prompt_tokens": 450,
      "completion_tokens": 50,
      "total_tokens": 500
    }
  },
  "scraping": {
    "status": "success",
    "contentLength": 3847
  },
  "database": {
    "saved": true,
    "deletedCount": 0,
    "createdCount": 6
  },
  "file": {
    "saved": true,
    "filePath": "/Users/nick/Documents/_project_resources/NewsNexus09/llm-01/responses/1234_2025-11-03T14-30-45-123Z.json",
    "error": null
  }
}
```

**Response (200 OK - Success without Scraping):**

```json
{
  "result": true,
  "message": "Successfully processed article with OpenAI and saved to database",
  "aiResponse": {
    "id": "chatcmpl-123",
    "object": "chat.completion",
    "created": 1677652288,
    "model": "gpt-4o-mini",
    "choices": [
      {
        "index": 0,
        "message": {
          "role": "assistant",
          "content": "{\"product\":\"generator\",\"state\":\"No state mentioned\",\"hazard\":\"fire\",\"relevance_score\":8,\"united_states_score\":5}"
        },
        "finish_reason": "stop"
      }
    ],
    "usage": {
      "prompt_tokens": 250,
      "completion_tokens": 45,
      "total_tokens": 295
    }
  },
  "scraping": {
    "status": "fail",
    "contentLength": 0
  },
  "database": {
    "saved": true,
    "deletedCount": 6,
    "createdCount": 6
  },
  "file": {
    "saved": true,
    "filePath": "/Users/nick/Documents/_project_resources/NewsNexus09/llm-01/responses/1234_2025-11-03T14-30-45-123Z.json",
    "error": null
  }
}
```

**Response (401 Unauthorized - Missing Token):**

```json
{
  "message": "Token is required"
}
```

**Response (403 Forbidden - Invalid Token):**

```json
{
  "message": "Invalid token"
}
```

**Response (404 Not Found):**

```json
{
  "result": false,
  "message": "Article not found with ID: 1234"
}
```

**Response (500 Internal Server Error - Template Error):**

```json
{
  "result": false,
  "message": "Error reading template file",
  "error": "ENOENT: no such file or directory"
}
```

**Response (500 Internal Server Error - Configuration):**

```json
{
  "result": false,
  "message": "KEY_OPEN_AI environment variable not configured"
}
```

**Response (500 Internal Server Error - OpenAI Error):**

```json
{
  "result": false,
  "message": "Error calling OpenAI API",
  "error": "Request failed with status code 401"
}
```

**Response (500 Internal Server Error - Database Error):**

```json
{
  "result": false,
  "message": "Error saving AI response to database",
  "error": "AI entity \"Open AI 4o mini API\" not found in database. Please create it first using POST /artificial-intelligence/add-entity",
  "aiResponse": {
    "id": "chatcmpl-123",
    "object": "chat.completion",
    "created": 1677652288,
    "model": "gpt-4o-mini",
    "choices": [
      {
        "index": 0,
        "message": {
          "role": "assistant",
          "content": "{\"product\":\"generator\",\"state\":\"No state mentioned\",\"hazard\":\"fire\",\"relevance_score\":8,\"united_states_score\":5}"
        },
        "finish_reason": "stop"
      }
    ],
    "usage": {
      "prompt_tokens": 250,
      "completion_tokens": 45,
      "total_tokens": 295
    }
  }
}
```

**Response (500 Internal Server Error - Generic):**

```json
{
  "result": false,
  "message": "Internal server error",
  "error": "Error description"
}
```

**Expected AI Response Format:**

The AI is prompted to return a JSON object with the following structure:

```json
{
  "product": "string",
  "state": "string",
  "hazard": "string",
  "relevance_score": 0,
  "united_states_score": 0
}
```

**AI Response Field Definitions:**

- `product`: Single word or phrase describing the consumer product (or "No product mentioned")
- `state`: Name of the US state where the event occurred (or "No state mentioned")
- `hazard`: Single word or phrase describing the safety hazard (or "No hazard mentioned")
- `relevance_score`: 0-10 score indicating relevance to consumer product safety (0=not relevant, 5=uncertain, 10=highly relevant)
- `united_states_score`: 0-10 score indicating confidence the event occurred in the US (0=definitely not US, 5=uncertain, 10=definitely US)

**Database Storage:**

The endpoint parses the AI response and stores it in the `ArticleEntityWhoCategorizedArticleContracts02` table with the following records:

| Key                    | Value Field   | Example Value         |
| ---------------------- | ------------- | --------------------- |
| product                | valueString   | "generator"           |
| state                  | valueString   | "No state mentioned"  |
| hazard                 | valueString   | "fire"                |
| relevance_score        | valueNumber   | 8                     |
| united_states_score    | valueNumber   | 5                     |
| scrapingStatus         | valueString   | "success" or "fail"   |

- All records share the same `articleId` and `entityWhoCategorizesId`
- Existing records for this combination are deleted before new records are created
- The `entityWhoCategorizesId` is obtained by looking up "Open AI 4o mini API" in the ArtificialIntelligences table

**Environment Variables Required:**

- `KEY_OPEN_AI`: OpenAI API key for authentication
- `PATH_PROJECT_RESOURCES`: Base directory path for storing response JSON files

**File Storage:**

- **Directory:** `{PATH_PROJECT_RESOURCES}/llm-01/responses/`
- **Filename Format:** `{articleId}_{timestamp}.json` (e.g., `1234_2025-11-03T14-30-45-123Z.json`)
- **Content:** Complete OpenAI API response including metadata, choices, and usage statistics
- **Auto-creation:** Directory is created automatically if it doesn't exist

**Example:**

```bash
curl -X POST http://localhost:8001/analysis/llm01/1234 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Web Scraping Details:**

- **Timeout:** 10 seconds maximum per request
- **User-Agent:** `Mozilla/5.0 (compatible; NewsNexusBot/1.0; +https://cpsc.gov/)`
- **Content Extraction:** Uses cheerio to parse HTML and extract visible text
- **Filtering:** Removes scripts, styles, navigation, footers, headers, forms, and SVGs
- **Truncation:** Content limited to 4000 characters to keep prompts manageable
- **Failure Handling:** Analysis continues even if scraping fails (uses only title and description)

**Notes:**

- Temperature is set to 0 for deterministic, consistent responses
- Max tokens limited to 100 to keep responses concise
- Template file location: `src/templates/prompt-markdown/prompt02.md`
- Scraping is optional - analysis proceeds with or without scraped content
- File saving is optional/precautionary - database storage is the primary persistence mechanism
- Authentication required - provide valid JWT token in Authorization header
- Timestamp in filename uses ISO 8601 format with colons and periods replaced by hyphens for filesystem compatibility

**Error Handling Behavior:**

1. **Article Not Found:** Returns 404 error immediately, does not attempt scraping or OpenAI API call
2. **Scraping Fails:** Continues with analysis using only title and description, sets scrapingStatus to "fail"
3. **OpenAI API Fails:** Returns 500 error, no database or file save occurs
4. **Database Save Fails:** Returns 500 error with full error details and AI response
5. **File Save Fails:** Continues successfully, includes error details in response but does not fail the request

**Prerequisites:**

Before using this endpoint, ensure the "Open AI 4o mini API" entity exists in the database:

```bash
POST /artificial-intelligence/add-entity
{
  "name": "Open AI 4o mini API",
  "description": "OpenAI GPT-4o-mini model for article analysis",
  "huggingFaceModelName": null,
  "huggingFaceModelType": null
}
```

**Related Files:**

- Route Implementation: `src/routes/analysis/llm01.js`
- Prompt Template: `src/templates/prompt-markdown/prompt02.md`
- Scraper Module: `src/modules/analysis/scraper.js`

---

### POST /analysis/llm01/scrape/:articleId

Test endpoint for debugging web scraping functionality. Attempts to scrape content from an article's URL and returns detailed results including timing, content length, and error information.

**Authentication:** Required (JWT token)

**URL Parameters:**

- `articleId` (integer, required): The ID of the article to test scraping

**Description:**

This is a diagnostic endpoint designed to help debug scraping issues. It performs the same scraping operation as the main analysis endpoint but returns detailed information about the scraping process without performing any AI analysis or database operations.

**Process Flow:**

1. Retrieves article from the database using the provided articleId
2. Attempts to scrape content from the article URL
3. Measures scraping duration
4. Captures any errors that occur
5. Returns comprehensive results including the full scraped content

**Response (200 OK - Successful Scrape):**

```json
{
  "result": true,
  "article": {
    "id": "128175",
    "title": "Generator Fire Causes Damage to Home",
    "url": "https://example.com/news/generator-fire"
  },
  "scraping": {
    "success": true,
    "duration": "1234ms",
    "contentLength": 3847,
    "content": "Full scraped article content appears here, truncated to 4000 characters...",
    "error": null
  }
}
```

**Response (200 OK - Failed Scrape):**

```json
{
  "result": true,
  "article": {
    "id": "128175",
    "title": "Generator Fire Causes Damage to Home",
    "url": "https://example.com/news/generator-fire"
  },
  "scraping": {
    "success": false,
    "duration": "10234ms",
    "contentLength": 0,
    "content": null,
    "error": {
      "message": "timeout of 10000ms exceeded",
      "stack": "Error: timeout of 10000ms exceeded\n    at createError (...)\n    ..."
    }
  }
}
```

**Response (401 Unauthorized - Missing Token):**

```json
{
  "message": "Token is required"
}
```

**Response (403 Forbidden - Invalid Token):**

```json
{
  "message": "Invalid token"
}
```

**Response (404 Not Found):**

```json
{
  "result": false,
  "message": "Article not found with ID: 999999"
}
```

**Response (500 Internal Server Error):**

```json
{
  "result": false,
  "message": "Internal server error",
  "error": "Error description",
  "stack": "Error stack trace..."
}
```

**Example:**

```bash
curl -X POST http://localhost:8001/analysis/llm01/scrape/128175 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Use Cases:**

1. **Debug Scraping Issues:** Identify why specific articles fail to scrape
2. **Test URL Accessibility:** Verify article URLs are accessible and return content
3. **Performance Testing:** Measure scraping duration for different websites
4. **Content Verification:** Preview scraped content before running full analysis
5. **Pattern Analysis:** Test multiple articles to identify common scraping failures

**Common Scraping Errors:**

- **Timeout (10000ms):** Website is slow or unresponsive - consider increasing timeout
- **403 Forbidden:** Website is blocking the bot - may need different User-Agent or headers
- **404 Not Found:** Article URL is invalid or has been removed
- **SSL/Certificate Errors:** SSL certificate issues on the target website
- **Empty Content:** Scraper successfully fetched HTML but couldn't extract text (unusual site structure)

**Related Files:**

- Route Implementation: `src/routes/analysis/llm01.js`
- Scraper Module: `src/modules/analysis/scraper.js`

---
