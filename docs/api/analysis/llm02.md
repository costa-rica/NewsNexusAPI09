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

### POST /analysis/llm02/service-login

Retrieves the EntityWhoCategorizedArticle ID associated with an AI service by looking up the service name in the ArtificialIntelligence table. This endpoint is used by external AI services to register themselves and obtain their categorizer entity ID for tracking their analysis work.

**Authentication:** Required (JWT token)

**URL Parameters:** None

**Request Body:**

```json
{
  "name": "Service Name from NAME_APP env variable"
}
```

**Request Body Fields:**

| Field | Type   | Required | Description                                          |
| ----- | ------ | -------- | ---------------------------------------------------- |
| name  | string | Yes      | Name of the AI service (from NAME_APP env variable) |

**Description:**

This endpoint allows AI services to authenticate and retrieve their associated EntityWhoCategorizedArticle ID. The service sends its NAME_APP value (from its environment configuration), and the API looks up this name in the ArtificialIntelligence table, retrieves the associated EntityWhoCategorizedArticle through the database relationship, and returns the entity ID. This ID is then used by the service to tag articles it processes.

**Use Cases:**

1. **Service Initialization**: AI services call this on startup to get their entity ID
2. **Service Registration**: Verify that the service exists in the database
3. **Identity Management**: Services use the returned ID to tag their analysis work
4. **Audit Trail**: Track which AI service processed which articles

**Response (200 OK - Success):**

```json
{
  "result": true,
  "name": "Open AI 4o mini API",
  "entityWhoCategorizesId": 42
}
```

**Response (400 Bad Request - Missing Name):**

```json
{
  "result": false,
  "message": "Missing required field: name"
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

**Response (404 Not Found - AI Entity Not Found):**

```json
{
  "result": false,
  "message": "AI entity with name \"My Service Name\" not found in database"
}
```

**Response (404 Not Found - No Associated Entity):**

```json
{
  "result": false,
  "message": "No EntityWhoCategorizedArticle associated with AI entity \"My Service Name\""
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
curl -X POST http://localhost:8001/analysis/llm02/service-login \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Open AI 4o mini API"}'
```

**Response Fields:**

| Field                   | Type   | Description                                    |
| ----------------------- | ------ | ---------------------------------------------- |
| result                  | boolean| Success status of the operation                |
| name                    | string | Confirmed name of the AI entity from database  |
| entityWhoCategorizesId  | number | The ID to use when categorizing articles       |

**Database Relationship:**

The endpoint queries the following relationship:

```
ArtificialIntelligence (name)
  → EntityWhoCategorizedArticle (id)
```

**Integration Example:**

AI services typically use this endpoint during initialization:

```javascript
// Service startup - get entity ID
const serviceName = process.env.NAME_APP; // e.g., "Open AI 4o mini API"

const response = await fetch('http://localhost:8001/analysis/llm02/service-login', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ name: serviceName })
});

const { entityWhoCategorizesId } = await response.json();

// Store entityWhoCategorizesId for use in article processing
// This ID is used when saving analysis results to the database
```

**Prerequisites:**

Before an AI service can use this endpoint, it must be registered in the database:

1. Create an ArtificialIntelligence record with the service name
2. Create an associated EntityWhoCategorizedArticle record
3. Link them through the database relationship

This can be done using:

```bash
POST /artificial-intelligence/add-entity
{
  "name": "My AI Service Name",
  "description": "Description of the AI service",
  "huggingFaceModelName": null,
  "huggingFaceModelType": null
}
```

**Notes:**

- The `name` field must exactly match the name in the ArtificialIntelligence table (case-sensitive)
- Each AI service should have a unique NAME_APP value in its .env file
- The returned entityWhoCategorizesId is used to track which service analyzed which articles
- Authentication is required to prevent unauthorized services from obtaining entity IDs
- Services should cache the entityWhoCategorizesId after initial login to reduce API calls

**Related Files:**

- Route Implementation: `src/routes/analysis/llm02.js`
- Related Endpoint: `POST /artificial-intelligence/add-entity`

**Related Endpoints:**

- `POST /artificial-intelligence/add-entity` - Register a new AI entity
- `POST /analysis/llm01/:articleId` - Example of endpoint that uses entity IDs

---

### POST /analysis/llm02/update-approved-status

Updates the approval status of an article based on AI service analysis. Creates records in ArticleApproveds, ArticleStateContracts (if approved), and ArticleEntityWhoCategorizedArticleContracts02 tables to track the analysis results and approval decision.

**Authentication:** Required (JWT token)

**URL Parameters:** None

**Request Body:**

```json
{
  "articleId": 12345,
  "isApproved": true,
  "entityWhoCategorizesId": 42,
  "llmAnalysis": {
    "product": "electric scooter",
    "state": "California",
    "hazard": "fire",
    "relevance_score": 9,
    "united_states_score": 10,
    "llmName": "Ollama"
  },
  "articleApprovedTextForPdfReport": "Electric scooter recall due to fire hazard in California",
  "stateId": 5
}
```

**Request Body Fields:**

| Field                           | Type    | Required | Description                                                  |
| ------------------------------- | ------- | -------- | ------------------------------------------------------------ |
| articleId                       | number  | Yes      | ID of the article being approved/rejected                    |
| isApproved                      | boolean | Yes      | Whether the article is approved (true) or rejected (false)   |
| entityWhoCategorizesId          | number  | Yes      | Entity ID from service-login endpoint                        |
| llmAnalysis                     | object  | Yes      | Analysis results from LLM (see structure below)              |
| articleApprovedTextForPdfReport | string  | No       | Text to include in PDF reports (can be null)                 |
| stateId                         | number  | No       | State ID if article relates to a specific US state (required if isApproved=true) |

**llmAnalysis Structure (Success Case):**

```json
{
  "product": "string - Product name or 'No product mentioned'",
  "state": "string - State name or 'No state mentioned'",
  "hazard": "string - Hazard type or 'No hazard mentioned'",
  "relevance_score": "number - 0-10 relevance to consumer safety",
  "united_states_score": "number - 0-10 confidence event is in US",
  "llmName": "string - LLM provider name (e.g., 'Ollama', 'OpenAI')"
}
```

**llmAnalysis Structure (Failed Case):**

```json
{
  "llmResponse": "failed",
  "llmName": "Ollama"
}
```

**Description:**

This endpoint processes article analysis results from AI services and updates the database accordingly. It performs validation checks, creates approval records, links articles to states (if approved), and stores detailed analysis results in a structured format.

**Process Flow:**

1. Validates required fields in request body
2. Checks if article already exists in ArticleApproveds table
   - If exists: Returns skip response with existing approval status
   - If not: Continues processing
3. Validates approval requirements:
   - If `isApproved=true`, requires `stateId` to be provided
   - If `isApproved=true` but `stateId` is missing: Returns error, skips all database operations
4. Creates ArticleApproveds record with userId from JWT token
5. Creates ArticleStateContracts record (only if `isApproved=true` AND `stateId` provided)
6. Deletes existing ArticleEntityWhoCategorizedArticleContracts02 records for this article/entity
7. Creates new ArticleEntityWhoCategorizedArticleContracts02 records based on llmAnalysis:
   - Success case: Stores all analysis fields (product, state, hazard, scores) plus metadata
   - Failed case: Stores only llmResponse="failed" and llmName

**Response (200 OK - Success):**

```json
{
  "result": true,
  "message": "Article approval status updated successfully",
  "articleId": 12345,
  "title": "Electric Scooter Recall Announced",
  "isApproved": true,
  "articleApproved": {
    "id": 789,
    "created": true
  },
  "articleStateContract": {
    "id": 456,
    "created": true
  },
  "llmAnalysisRecords": {
    "deletedCount": 0,
    "createdCount": 7
  }
}
```

**Response (200 OK - Already Exists / Skipped):**

```json
{
  "result": false,
  "skipped": true,
  "message": "Article already in ArticleApproveds table",
  "articleId": 12345,
  "title": "Electric Scooter Recall Announced",
  "existingIsApproved": true
}
```

**Response (400 Bad Request - Missing Required Fields):**

```json
{
  "result": false,
  "message": "Missing required fields: articleId, isApproved, entityWhoCategorizesId, llmAnalysis"
}
```

**Response (400 Bad Request - Missing stateId for Approval):**

```json
{
  "result": false,
  "skipped": true,
  "message": "Cannot approve article without stateId. Both isApproved=true and stateId are required for approval.",
  "articleId": 12345
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

**Response (404 Not Found - Article Not Found):**

```json
{
  "result": false,
  "message": "Article not found with ID: 12345"
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

**Example (Approve Article):**

```bash
curl -X POST http://localhost:8001/analysis/llm02/update-approved-status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "articleId": 12345,
    "isApproved": true,
    "entityWhoCategorizesId": 42,
    "llmAnalysis": {
      "product": "electric scooter",
      "state": "California",
      "hazard": "fire",
      "relevance_score": 9,
      "united_states_score": 10,
      "llmName": "Ollama"
    },
    "articleApprovedTextForPdfReport": "Electric scooter recall due to fire hazard",
    "stateId": 5
  }'
```

**Example (Reject Article - LLM Failed):**

```bash
curl -X POST http://localhost:8001/analysis/llm02/update-approved-status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "articleId": 12346,
    "isApproved": false,
    "entityWhoCategorizesId": 42,
    "llmAnalysis": {
      "llmResponse": "failed",
      "llmName": "Ollama"
    },
    "articleApprovedTextForPdfReport": null,
    "stateId": null
  }'
```

**Database Tables Updated:**

| Table                                          | When Created                                    | Purpose                                  |
| ---------------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| ArticleApproveds                               | Always (if not duplicate)                       | Tracks article approval status           |
| ArticleStateContracts                          | Only if isApproved=true AND stateId provided    | Links approved articles to states        |
| ArticleEntityWhoCategorizedArticleContracts02  | Always (if not duplicate)                       | Stores detailed LLM analysis results     |

**ArticleEntityWhoCategorizedArticleContracts02 Records Created:**

For successful LLM analysis:
- `llmResponse` → "success" (valueString)
- `llmName` → provider name (valueString)
- `product` → value (valueString)
- `state` → value (valueString)
- `hazard` → value (valueString)
- `relevance_score` → value (valueNumber)
- `united_states_score` → value (valueNumber)

For failed LLM analysis:
- `llmResponse` → "failed" (valueString)
- `llmName` → provider name (valueString)

**Validation Rules:**

1. **Duplicate Prevention**: Articles already in ArticleApproveds table are skipped
2. **Approval Requirements**: isApproved=true requires stateId to be provided
3. **Missing stateId**: If isApproved=true but stateId is null, entire process is skipped
4. **Failed LLM**: When llmResponse="failed", only metadata records are created

**Integration Example:**

AI services typically use this endpoint after analyzing an article:

```javascript
// After getting entityWhoCategorizesId from service-login
const analysisResult = await analyzArticleWithLLM(article);

// Determine approval based on scores
const isApproved = analysisResult.relevance_score >= 7 &&
                   analysisResult.united_states_score >= 7;

// Get stateId if a state was identified
const stateId = analysisResult.state !== "No state mentioned"
  ? await lookupStateId(analysisResult.state)
  : null;

// Update article approval status
const response = await fetch('http://localhost:8001/analysis/llm02/update-approved-status', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    articleId: article.id,
    isApproved: isApproved,
    entityWhoCategorizesId: entityId,
    llmAnalysis: {
      ...analysisResult,
      llmName: process.env.LLM_PROVIDER || "Ollama"
    },
    articleApprovedTextForPdfReport: isApproved ? generateReportText(article) : null,
    stateId: stateId
  })
});
```

**Notes:**

- The `userId` field in ArticleApproveds is automatically populated from the JWT token
- Duplicate approvals are prevented - each article can only have one approval record
- If isApproved=true, both approval and stateId are mandatory
- Existing ArticleEntityWhoCategorizedArticleContracts02 records for the same article/entity are deleted before creating new ones
- The llmName field identifies which LLM provider performed the analysis
- Failed LLM responses still create tracking records but with minimal data
- Authentication required to track which user/service approved each article

**Related Files:**

- Route Implementation: `src/routes/analysis/llm02.js`
- Related Tables: ArticleApproveds, ArticleStateContracts, ArticleEntityWhoCategorizedArticleContracts02

**Related Endpoints:**

- `POST /analysis/llm02/service-login` - Get entityWhoCategorizesId before using this endpoint
- `GET /analysis/llm02/no-article-approved-rows` - Get articles that need approval
- `POST /analysis/llm01/:articleId` - Alternative analysis endpoint

---
