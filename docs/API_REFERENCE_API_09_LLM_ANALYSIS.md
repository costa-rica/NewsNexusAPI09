# API Reference - News Nexus API 09 LLM Analysis

This document provides comprehensive documentation for all LLM analysis endpoints in the News Nexus API 09 service.

## LLM Analysis Endpoints

All LLM analysis endpoints are prefixed with `/analysis/llm01` and use OpenAI's GPT models to analyze articles for consumer product safety hazards.

### POST /analysis/llm01/:articleId

Analyzes a news article using OpenAI's GPT-4o-mini model to determine if it describes consumer product safety hazards in the United States. The endpoint retrieves the article from the database, applies a prompt template, sends it to OpenAI, and saves the response to a JSON file.

**Authentication:** Not required

**URL Parameters:**

- `articleId` (integer, required): The ID of the article to analyze

**Description:**

This endpoint performs AI-powered analysis of news articles to identify consumer product safety hazards. It uses a structured prompt template to ensure consistent analysis across all articles.

**Process Flow:**

1. Retrieves article title and description from the database using the provided articleId
2. Reads the prompt template from `src/templates/prompt-markdown/prompt02.md`
3. Replaces `<< ARTICLE_TITLE >>` and `<< ARTICLE_DESCRIPTION >>` placeholders with actual article data
4. Sends the completed prompt to OpenAI's GPT-4o-mini model with:
   - Temperature: 0 (deterministic responses)
   - Max tokens: 100 (concise responses)
5. Saves the full OpenAI API response to `{PATH_PROJECT_RESOURCES}/llm-01/responses/{articleId}_{timestamp}.json`
6. Returns both the AI response and file path to the client

**Response (200 OK - Success):**

```json
{
  "result": true,
  "message": "Successfully processed article with OpenAI",
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
      "prompt_tokens": 250,
      "completion_tokens": 50,
      "total_tokens": 300
    }
  },
  "filePath": "/Users/nick/Documents/_project_resources/NewsNexus09/llm-01/responses/1234_2025-11-03T14-30-45-123Z.json"
}
```

**Response (200 OK - File Save Error):**

```json
{
  "result": true,
  "message": "OpenAI response received but file save failed",
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
      "prompt_tokens": 250,
      "completion_tokens": 50,
      "total_tokens": 300
    }
  },
  "filePath": null,
  "fileError": "EACCES: permission denied"
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

**Field Definitions:**

- `product`: Single word or phrase describing the consumer product (or "No product mentioned")
- `state`: Name of the US state where the event occurred (or "No state mentioned")
- `hazard`: Single word or phrase describing the safety hazard (or "No hazard mentioned")
- `relevance_score`: 0-10 score indicating relevance to consumer product safety (0=not relevant, 5=uncertain, 10=highly relevant)
- `united_states_score`: 0-10 score indicating confidence the event occurred in the US (0=definitely not US, 5=uncertain, 10=definitely US)

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
curl -X POST http://localhost:8001/analysis/llm01/1234
```

**Notes:**

- Temperature is set to 0 for deterministic, consistent responses
- Max tokens limited to 100 to keep responses concise
- Template file location: `src/templates/prompt-markdown/prompt02.md`
- The endpoint will still return the AI response even if file saving fails
- No authentication required - useful for testing and automation
- Timestamp in filename uses ISO 8601 format with colons and periods replaced by hyphens for filesystem compatibility

**Error Handling Behavior:**

1. **Article Not Found:** Returns 404 error immediately, does not call OpenAI API
2. **OpenAI API Fails:** Returns 500 error, no file is created
3. **File Save Fails:** Returns 200 with AI response, includes error details in `fileError` field

**Related Files:**

- Route Implementation: `src/routes/analysis/llm01.js`
- Prompt Template: `src/templates/prompt-markdown/prompt02.md`

---
