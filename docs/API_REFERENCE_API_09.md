# API Reference - News Nexus API 09

This document provides comprehensive documentation for all available API endpoints in the News Nexus API 09 service.

## Deduper Endpoints

All deduper endpoints are prefixed with `/deduper` and require JWT authentication.

### POST /deduper/report-checker-table

Analyzes articles in a report to identify duplicates across all approved articles. Creates a comprehensive duplicate analysis dictionary and generates an Excel spreadsheet report.

**Authentication:** Required (JWT token)

**Request Body:**
```json
{
  "reportId": 123,
  "embeddingThresholdMinimum": 0.85,
  "spacerRow": true
}
```

**Parameters:**
- `reportId` (integer, required): The report ID to analyze
- `embeddingThresholdMinimum` (float, required): Minimum embedding similarity score threshold (0-1) for including approved articles in the analysis
- `spacerRow` (boolean, optional): When true, inserts an empty row between article groups in the Excel output for improved readability. Defaults to false if not provided

**Logic Overview:**

This endpoint performs a multi-step analysis to identify duplicate articles:

1. **Data Collection Phase:**
   - Retrieves all approved articles data via `makeArticleApprovedsTableDictionary()` (src/modules/deduper.js:16)
   - Fetches all articles associated with the report from `ArticleReportContract` table
   - Builds reference number map from ALL `ArticleReportContract` records, selecting the latest report (highest reportId) for each article
   - Queries `ArticleDuplicateAnalysis` table for similarity scores between report articles and approved articles

2. **Dictionary Construction Phase:**
   - Builds `reportArticleDictionary` with article IDs as root-level keys
   - Each entry contains:
     - `maxEmbedding`: Highest similarity score found for this article
     - `articleReferenceNumberInReport`: Reference number from ArticleReportContract table
     - `newArticleInformation`: Article data from ArticleApproveds (headline, publication, date, text, URL, state)
     - `approvedArticlesArray`: Array of approved articles that exceed the embedding threshold, sorted by similarity score (descending)

3. **Filtering and Sorting:**
   - Excludes self-matches (`sameArticleIdFlag = 0`)
   - Only includes approved articles with `embeddingSearch >= embeddingThresholdMinimum`
   - Sorts approved articles by embedding score (highest similarity first)

4. **Report Generation:**
   - Calls `createDeduperAnalysis()` (src/modules/deduper.js:77) to generate Excel spreadsheet
   - Spreadsheet organizes data into groups where each group consists of:
     - **First row**: New article data (the report article being analyzed)
     - **Subsequent rows**: Approved articles that match above threshold, ordered by similarity
   - Groups are sorted by `maxEmbedding` (highest similarity groups first)

**Response (200 OK):**
```json
{
  "length": 25,
  "reportArticleDictionary": {
    "1234": {
      "maxEmbedding": 0.92,
      "articleReferenceNumberInReport": 5,
      "newArticleInformation": {
        "headlineForPdfReport": "Sample Headline",
        "publicationNameForPdfReport": "News Source",
        "publicationDateForPdfReport": "2025-09-28",
        "textForPdfReport": "Article text...",
        "urlForPdfReport": "https://example.com/article",
        "state": "CA"
      },
      "approvedArticlesArray": [
        {
          "articleIdApproved": 5678,
          "embeddingSearch": 0.92,
          "headlineForPdfReport": "Similar Headline",
          "publicationNameForPdfReport": "Other Source",
          "publicationDateForPdfReport": "2025-09-20",
          "textForPdfReport": "Similar article text...",
          "urlForPdfReport": "https://example.com/similar",
          "state": "NY"
        }
      ]
    }
  }
}
```

**Response (500 Internal Server Error):**
```json
{
  "result": false,
  "message": "Internal server error",
  "error": "Error description"
}
```

**Excel Spreadsheet Structure:**

The generated spreadsheet (`deduper_analysis.xlsx`) follows this structure:

**Columns:** Id | articleIdNew | articleReportRefIdNew | ArticleIdApproved | articleReportRefIdApproved | embeddingSearch | headlineForPdfReport | publicationNameForPdfReport | publicationDateForPdfReport | textForPdfReport | urlForPdfReport | state

**Row Organization:**
- Groups are ordered by `maxEmbedding` (descending)
- Within each group:
  - Row 1: New article (where `articleIdNew = ArticleIdApproved`, `articleReportRefIdNew = articleReportRefIdApproved`, `embeddingSearch = 1`)
  - Rows 2+: Approved articles ordered by similarity score (descending), with their corresponding reference numbers
- When `spacerRow` is true, an empty row is inserted between groups (but not after the last group) for improved readability
- Only groups with matching approved articles are included (empty groups are skipped)
- Reference numbers come from the `articleReferenceNumberInReport` field in the `ArticleReportContract` table
- For articles appearing in multiple reports, the reference number from the latest report (highest reportId) is used

**Environment Variables Required:**
- `PATH_TO_UTILITIES_ANALYSIS_SPREADSHEETS`: Directory path for saving Excel reports

**Example:**
```bash
curl -X POST http://localhost:8001/deduper/report-checker-table \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reportId": 123,
    "embeddingThresholdMinimum": 0.85,
    "spacerRow": true
  }'
```

---

### GET /deduper/request-job/:reportId

Initiates a deduper job in NewsNexusPythonQueuer to analyze articles for duplicates. Creates a CSV file containing article IDs and triggers the deduper microservice.

**Authentication:** Required (JWT token)

**URL Parameters:**
- `reportId` (integer, required): The report ID to process

**Description:**

This endpoint serves as a bridge between NewsNexusAPI09 and the NewsNexusPythonQueuer service. It:

1. Retrieves all article IDs associated with the specified report
2. Creates a CSV file (`article_ids.csv`) containing the article IDs in the deduper utilities directory
3. Sends a GET request to NewsNexusPythonQueuer to trigger a deduper job

For details on the deduper job processing, see the [NewsNexusPythonQueuer API documentation](./API_REFERENCE_PYTHON_QUEUER_01.md#deduper-endpoints).

**Process Flow:**
1. Query `ArticleReportContract` table for all articles in the report
2. Generate CSV file with header "articleId" followed by one article ID per line
3. Write CSV to `{PATH_TO_UTILITIES_DEDUPER}/article_ids.csv`
4. Send GET request to `{URL_BASE_NEWS_NEXUS_PYTHON_QUEUER}/deduper/jobs`
5. Return combined response with CSV info and job details

**Response (200 OK):**
```json
{
  "result": true,
  "message": "Job request successful",
  "csvFilePath": "/path/to/deduper/article_ids.csv",
  "articleCount": 25,
  "pythonQueuerResponse": {
    "jobId": 1,
    "status": "pending"
  }
}
```

**Response (404 Not Found):**
```json
{
  "result": false,
  "message": "No articles found for reportId: 123"
}
```

**Response (500 Internal Server Error):**
```json
{
  "result": false,
  "message": "PATH_TO_UTILITIES_DEDUPER environment variable not configured"
}
```

or

```json
{
  "result": false,
  "message": "URL_BASE_NEWS_NEXUS_PYTHON_QUEUER environment variable not configured"
}
```

or

```json
{
  "result": false,
  "message": "Internal server error",
  "error": "Error description"
}
```

**Environment Variables Required:**
- `PATH_TO_UTILITIES_DEDUPER`: Directory path where article_ids.csv will be created
- `URL_BASE_NEWS_NEXUS_PYTHON_QUEUER`: Base URL of the NewsNexusPythonQueuer service (e.g., "http://localhost:5000/")

**CSV File Format:**
```csv
articleId
1234
5678
9012
```

**Example:**
```bash
curl -X GET http://localhost:8001/deduper/request-job/123 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Related Documentation:**
- [NewsNexusPythonQueuer Deduper Endpoints](./API_REFERENCE_PYTHON_QUEUER_01.md#deduper-endpoints)

---

### GET /deduper/job-list-status

Retrieves the status of all deduper jobs by relaying the request to the NewsNexusPythonQueuer service.

**Authentication:** Required (JWT token)

**Description:**

This endpoint acts as a proxy to the NewsNexusPythonQueuer's `GET /deduper/jobs/list` endpoint. It retrieves a list of all deduper jobs with their current status and creation timestamps.

For detailed information about job statuses and the underlying service, see the [NewsNexusPythonQueuer API documentation](./API_REFERENCE_PYTHON_QUEUER_01.md#get-deduperjobslist).

**Process Flow:**
1. Validates that the NewsNexusPythonQueuer service is configured
2. Sends a GET request to `{URL_BASE_NEWS_NEXUS_PYTHON_QUEUER}/deduper/jobs/list`
3. Returns the response from the Python Queuer service

**Response (200 OK):**
```json
{
  "jobs": [
    {
      "jobId": 1,
      "status": "completed",
      "createdAt": "2025-09-28T17:45:30.123Z"
    },
    {
      "jobId": 2,
      "status": "running",
      "createdAt": "2025-09-28T17:50:15.456Z"
    },
    {
      "jobId": 3,
      "status": "pending",
      "createdAt": "2025-09-28T17:52:00.789Z"
    }
  ]
}
```

**Job Status Values:**
- `pending`: Job created but not yet started
- `running`: Job is currently executing
- `completed`: Job finished successfully (exit code 0)
- `failed`: Job finished with errors (non-zero exit code)
- `cancelled`: Job was manually terminated

**Response (500 Internal Server Error - Configuration):**
```json
{
  "result": false,
  "message": "URL_BASE_NEWS_NEXUS_PYTHON_QUEUER environment variable not configured"
}
```

**Response (500 Internal Server Error - Python Queuer Error):**
```json
{
  "result": false,
  "message": "Error fetching job list from Python Queuer",
  "error": "Error description",
  "pythonQueuerResponse": {
    "error": "Details from Python Queuer"
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

**Environment Variables Required:**
- `URL_BASE_NEWS_NEXUS_PYTHON_QUEUER`: Base URL of the NewsNexusPythonQueuer service (e.g., "http://localhost:5000/")

**Example:**
```bash
curl -X GET http://localhost:8001/deduper/job-list-status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Related Documentation:**
- [NewsNexusPythonQueuer GET /deduper/jobs/list](./API_REFERENCE_PYTHON_QUEUER_01.md#get-deduperjobslist)

**Notes:**
- Job IDs are sequential integers starting from 1
- Job IDs reset when the NewsNexusPythonQueuer service restarts
- The jobs array may be empty if no jobs have been created yet

---

### DELETE /deduper/clear-article-duplicate-analyses-table

Clears the ArticleDuplicateAnalysis table by sending a request to the NewsNexusPythonQueuer service. This operation cancels all running/pending deduper jobs and removes all duplicate analysis data from the database.

**Authentication:** Required (JWT token)

**Description:**

This endpoint acts as a proxy to the NewsNexusPythonQueuer's `DELETE /deduper/clear-db-table` endpoint. It performs the following operations:

1. Validates that the NewsNexusPythonQueuer service is configured
2. Sends a DELETE request to `{URL_BASE_NEWS_NEXUS_PYTHON_QUEUER}/deduper/clear-db-table`
3. Returns the response from the Python Queuer service

**IMPORTANT:** This is a destructive operation that:
- Immediately cancels ALL pending and running deduper jobs
- Executes the `clear_table -y` command from NewsNexusDeduper02
- Permanently clears all data from the ArticleDuplicateAnalysis table

For detailed information about the underlying clear operation, see the [NewsNexusPythonQueuer API documentation](./API_REFERENCE_PYTHON_QUEUER_01.md#delete-deduperclear-db-table).

**Response (200 OK):**
```json
{
  "result": true,
  "message": "Article duplicate analyses table cleared successfully",
  "pythonQueuerResponse": {
    "cleared": true,
    "cancelledJobs": [3, 5, 7],
    "exitCode": 0,
    "stdout": "Table cleared successfully...",
    "stderr": "",
    "timestamp": "2025-09-28T17:45:30.123Z"
  }
}
```

**Response (500 Internal Server Error - Configuration):**
```json
{
  "result": false,
  "message": "URL_BASE_NEWS_NEXUS_PYTHON_QUEUER environment variable not configured"
}
```

**Response (500 Internal Server Error - Python Queuer Error):**
```json
{
  "result": false,
  "message": "Error clearing table via Python Queuer",
  "error": "Error description",
  "pythonQueuerResponse": {
    "cleared": false,
    "cancelledJobs": [3, 5],
    "exitCode": 1,
    "stdout": "",
    "stderr": "Error clearing table...",
    "error": "Clear table command failed",
    "timestamp": "2025-09-28T17:45:30.123Z"
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

**Python Queuer Response Fields:**
- `cleared`: Boolean indicating if the table was successfully cleared
- `cancelledJobs`: Array of job IDs that were cancelled before clearing
- `exitCode`: Exit code from the clear_table command (0 = success)
- `stdout`: Standard output from the clear_table command
- `stderr`: Standard error from the clear_table command
- `timestamp`: ISO 8601 timestamp of when the operation completed

**Environment Variables Required:**
- `URL_BASE_NEWS_NEXUS_PYTHON_QUEUER`: Base URL of the NewsNexusPythonQueuer service (e.g., "http://localhost:5000/")

**Example:**
```bash
curl -X DELETE http://localhost:8001/deduper/clear-article-duplicate-analyses-table \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Related Documentation:**
- [NewsNexusPythonQueuer DELETE /deduper/clear-db-table](./API_REFERENCE_PYTHON_QUEUER_01.md#delete-deduperclear-db-table)

**Notes:**
- This operation runs synchronously through the Python Queuer (not queued)
- Has a 60-second timeout for safety (enforced by Python Queuer)
- All active deduper jobs are automatically cancelled before the table is cleared
- Use with caution - this permanently removes all deduplication analysis data

---
