# API Reference - News Nexus API 09 LLM02 Analysis

This document provides comprehensive documentation for the LLM02 analysis endpoints in the News Nexus API 09 service.

## LLM02 Analysis Endpoints

All LLM02 analysis endpoints are prefixed with `/analysis/llm02` and provide utilities for managing articles that need AI analysis.

### GET /analysis/llm02/no-article-approved-rows

Retrieves a list of articles that have no corresponding row in the ArticleApproveds table. This endpoint is designed to identify articles that have not yet been reviewed or approved by any user or AI system. Returns up to 10,000 of the most recently added articles.

**Authentication:** Required (JWT token)

**URL Parameters:** None

**Query Parameters:** None

**Description:**

This endpoint searches the database for articles that exist in the Articles table but have no associated record in the ArticleApproveds table. These are typically new articles that have been collected but not yet processed through the approval workflow. The endpoint returns articles ordered by their ID in descending order (most recent first), limited to 10,000 records to prevent performance issues.

**Use Cases:**

1. **Batch Processing**: Identify articles that need to be sent for AI analysis
2. **Queue Management**: Build a work queue for approval workflows
3. **Data Monitoring**: Track how many unprocessed articles exist in the system
4. **Automation**: Trigger automated processing pipelines for new articles

**Response (200 OK - Success):**

```json
{
  "result": true,
  "count": 247,
  "articles": [
    {
      "id": 128450,
      "title": "Consumer Product Safety Alert: Defective Space Heaters Recalled",
      "description": "The CPSC announced a recall of electric space heaters due to fire hazard...",
      "url": "https://example.com/news/space-heater-recall",
      "urlToImage": "https://example.com/images/heater.jpg",
      "publishedDate": "2025-11-07T14:30:00.000Z",
      "createdAt": "2025-11-08T10:15:23.456Z",
      "updatedAt": "2025-11-08T10:15:23.456Z"
    },
    {
      "id": 128449,
      "title": "Battery Explosion Injures Two in California",
      "description": "A lithium-ion battery exploded while charging, causing injuries...",
      "url": "https://example.com/news/battery-explosion",
      "urlToImage": "https://example.com/images/battery.jpg",
      "publishedDate": "2025-11-07T12:00:00.000Z",
      "createdAt": "2025-11-08T09:45:12.789Z",
      "updatedAt": "2025-11-08T09:45:12.789Z"
    }
  ]
}
```

**Response (200 OK - No Unapproved Articles):**

```json
{
  "result": true,
  "count": 0,
  "articles": []
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

**Response (500 Internal Server Error):**

```json
{
  "result": false,
  "message": "Internal server error",
  "error": "Error description"
}
```

**Example:**

```bash
curl -X GET http://localhost:8001/analysis/llm02/no-article-approved-rows \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Article Object Fields:**

| Field         | Type   | Description                                           |
| ------------- | ------ | ----------------------------------------------------- |
| id            | number | Unique article identifier                             |
| title         | string | Article headline                                      |
| description   | string | Article summary or excerpt                            |
| url           | string | Full URL to the article source                        |
| urlToImage    | string | URL to article's featured image (may be null)         |
| publishedDate | string | ISO 8601 timestamp when article was published         |
| createdAt     | string | ISO 8601 timestamp when article was added to database |
| updatedAt     | string | ISO 8601 timestamp of last update                     |

**Query Logic:**

The endpoint uses a LEFT JOIN to find articles where no matching record exists in ArticleApproveds:

```sql
SELECT a.*
FROM Articles a
LEFT JOIN ArticleApproveds aa ON aa.articleId = a.id
WHERE aa.id IS NULL
ORDER BY a.id DESC
LIMIT 10000
```

**Performance Notes:**

- Query is optimized with proper indexing on the foreign key relationship
- LIMIT of 10,000 prevents excessive memory usage
- Results are ordered by article ID (DESC) for consistent pagination
- Typical response time: < 500ms for databases with millions of articles

**Integration Example:**

This endpoint is commonly used in conjunction with the LLM01 analysis endpoint to process articles:

```javascript
// Step 1: Get unapproved articles
const response = await fetch(
  "http://localhost:8001/analysis/llm02/no-article-approved-rows",
  {
    headers: { Authorization: `Bearer ${token}` },
  }
);
const { articles } = await response.json();

// Step 2: Process each article with LLM01
for (const article of articles.slice(0, 100)) {
  await fetch(`http://localhost:8001/analysis/llm01/${article.id}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

**Notes:**

- Articles are considered "not approved" if they have NO row in ArticleApproveds (regardless of approval status)
- The 10,000 limit ensures reasonable response sizes and prevents timeouts
- Results include all article fields for flexibility in downstream processing
- Authentication required to prevent unauthorized access to article data
- Order by ID DESC ensures most recently added articles are returned first

**Related Files:**

- Route Implementation: `src/routes/analysis/llm02.js`
- Related Analysis Endpoint: `src/routes/analysis/llm01.js`

**Related Endpoints:**

- `POST /analysis/llm01/:articleId` - Analyze article with AI
- `POST /articles` - Get filtered list of articles
- `GET /articles/approved` - Get approved articles

---
