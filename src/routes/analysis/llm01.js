var express = require("express");
var router = express.Router();
const {
  Article,
  ArtificialIntelligence,
  EntityWhoCategorizedArticle,
  ArticleEntityWhoCategorizedArticleContracts02,
} = require("newsnexusdb09");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const { scrapeArticle } = require("../../modules/analysis/scraper");

/**
 * Helper function to save AI response to file (optional/precautionary)
 * Errors are logged but don't affect the main flow
 */
async function saveResponseToFile(articleId, aiResponse) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${articleId}_${timestamp}.json`;
    const responsesDir = path.join(
      process.env.PATH_PROJECT_RESOURCES,
      "llm-01/responses"
    );
    const filePath = path.join(responsesDir, fileName);

    await fs.mkdir(responsesDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(aiResponse, null, 2), "utf-8");
    console.log(`Response saved to: ${filePath}`);
    return { success: true, filePath };
  } catch (error) {
    console.error("Error saving response to file:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper function to save parsed AI response to database
 * Stores key-value pairs in ArticleEntityWhoCategorizedArticleContracts02
 */
async function saveResponseToDatabase(articleId, aiResponse, scrapingStatus) {
  // Step 1: Look up "Open AI 4o mini API" entity
  const aiModel = await ArtificialIntelligence.findOne({
    where: {
      name: "Open AI 4o mini API",
    },
    include: [
      {
        model: EntityWhoCategorizedArticle,
        as: "EntityWhoCategorizedArticles",
      },
    ],
  });

  if (!aiModel) {
    throw new Error(
      'AI entity "Open AI 4o mini API" not found in database. Please create it first using POST /artificial-intelligence/add-entity'
    );
  }

  const entity = aiModel?.EntityWhoCategorizedArticles?.[0];
  if (!entity) {
    throw new Error(
      'No EntityWhoCategorizedArticle associated with "Open AI 4o mini API"'
    );
  }

  const entityWhoCategorizesId = entity.id;
  console.log(
    `Using entityWhoCategorizesId: ${entityWhoCategorizesId} for AI entity: ${aiModel.name}`
  );

  // Step 2: Parse the JSON response from AI
  const aiContent = aiResponse.choices?.[0]?.message?.content;
  if (!aiContent) {
    throw new Error("No content found in AI response");
  }

  let parsedContent;
  try {
    parsedContent = JSON.parse(aiContent);
  } catch (error) {
    throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
  }

  console.log("Parsed AI content:", parsedContent);

  // Step 3: Delete existing records with same articleId + entityWhoCategorizesId
  const deletedCount = await ArticleEntityWhoCategorizedArticleContracts02.destroy(
    {
      where: {
        articleId: articleId,
        entityWhoCategorizesId: entityWhoCategorizesId,
      },
    }
  );

  console.log(
    `Deleted ${deletedCount} existing records for articleId ${articleId} and entityWhoCategorizesId ${entityWhoCategorizesId}`
  );

  // Step 4: Create new records for each key-value pair
  const recordsToCreate = [];
  for (const [key, value] of Object.entries(parsedContent)) {
    const record = {
      articleId: parseInt(articleId),
      entityWhoCategorizesId: entityWhoCategorizesId,
      key: key,
      valueString: null,
      valueNumber: null,
      valueBoolean: null,
    };

    // Determine type and populate appropriate field
    if (typeof value === "boolean") {
      record.valueBoolean = value;
    } else if (typeof value === "number") {
      record.valueNumber = value;
    } else if (typeof value === "string") {
      record.valueString = value;
    } else {
      // For complex types, stringify them
      record.valueString = JSON.stringify(value);
    }

    recordsToCreate.push(record);
  }

  // Step 4b: Add scrapingStatus record
  recordsToCreate.push({
    articleId: parseInt(articleId),
    entityWhoCategorizesId: entityWhoCategorizesId,
    key: "scrapingStatus",
    valueString: scrapingStatus,
    valueNumber: null,
    valueBoolean: null,
  });

  // Bulk create all records
  const createdRecords = await ArticleEntityWhoCategorizedArticleContracts02.bulkCreate(
    recordsToCreate
  );

  console.log(`Created ${createdRecords.length} new records in database`);

  return {
    deletedCount,
    createdCount: createdRecords.length,
    records: createdRecords,
  };
}

// 🔹 POST /analysis/llm01/:articleId
router.post("/:articleId", async (req, res) => {
  console.log(`- in POST /analysis/llm01/:articleId`);

  try {
    const { articleId } = req.params;
    console.log(`articleId: ${articleId}`);

    // Step 1: Get article from database
    const article = await Article.findByPk(articleId);

    if (!article) {
      return res.status(404).json({
        result: false,
        message: `Article not found with ID: ${articleId}`,
      });
    }

    const { title, description, url } = article;
    console.log(`Article found: ${title}`);

    // Step 2: Scrape article content from URL
    console.log(`Attempting to scrape content from: ${url}`);
    const scrapedContent = await scrapeArticle(url);
    const scrapingStatus = scrapedContent ? "success" : "fail";
    console.log(`Scraping status: ${scrapingStatus}`);

    // Step 3: Read the template file
    const templatePath = path.join(
      __dirname,
      "../../templates/prompt-markdown/prompt02.md"
    );
    let promptTemplate;

    try {
      promptTemplate = await fs.readFile(templatePath, "utf-8");
    } catch (error) {
      console.error("Error reading template file:", error);
      return res.status(500).json({
        result: false,
        message: "Error reading template file",
        error: error.message,
      });
    }

    // Step 4: Replace placeholders in template and handle scraped content
    let prompt = promptTemplate
      .replace(/<< ARTICLE_TITLE >>/g, title || "")
      .replace(/<< ARTICLE_DESCRIPTION >>/g, description || "");

    // Conditionally handle scraped content
    if (scrapedContent) {
      // Replace placeholder with scraped content
      prompt = prompt.replace(
        /<< ARTICLE_SCRAPED_CONTENT >>/g,
        scrapedContent
      );
    } else {
      // Remove the entire "### Article Content" section if scraping failed
      prompt = prompt.replace(
        /### Article Content\s*\n\s*<< ARTICLE_SCRAPED_CONTENT >>\s*/g,
        ""
      );
    }

    // Step 5: Call OpenAI API
    const openAiApiKey = process.env.KEY_OPEN_AI;
    if (!openAiApiKey) {
      return res.status(500).json({
        result: false,
        message: "KEY_OPEN_AI environment variable not configured",
      });
    }

    let aiResponse;
    let aiError = null;

    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0,
          max_tokens: 100,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiApiKey}`,
          },
        }
      );

      aiResponse = response.data;
      console.log("OpenAI API response received");
    } catch (error) {
      console.error("Error calling OpenAI API:", error.message);
      aiError = error.message;

      // If OpenAI fails, return error immediately (no response to save)
      return res.status(500).json({
        result: false,
        message: "Error calling OpenAI API",
        error: error.message,
      });
    }

    // Step 6: Save response to database (critical path)
    let dbSaveResult;
    try {
      dbSaveResult = await saveResponseToDatabase(
        articleId,
        aiResponse,
        scrapingStatus
      );
      console.log(
        `Database save successful: ${dbSaveResult.createdCount} records created`
      );
    } catch (error) {
      console.error("Error saving to database:", error);
      // Database save failure is a critical error
      return res.status(500).json({
        result: false,
        message: "Error saving AI response to database",
        error: error.message,
        aiResponse: aiResponse,
      });
    }

    // Step 7: Save response to file (optional/precautionary)
    const fileSaveResult = await saveResponseToFile(articleId, aiResponse);

    // Step 8: Return response
    res.status(200).json({
      result: true,
      message:
        "Successfully processed article with OpenAI and saved to database",
      aiResponse: aiResponse,
      scraping: {
        status: scrapingStatus,
        contentLength: scrapedContent ? scrapedContent.length : 0,
      },
      database: {
        saved: true,
        deletedCount: dbSaveResult.deletedCount,
        createdCount: dbSaveResult.createdCount,
      },
      file: {
        saved: fileSaveResult.success,
        filePath: fileSaveResult.filePath || null,
        error: fileSaveResult.error || null,
      },
    });
  } catch (error) {
    console.error("Error in POST /analysis/llm01/:articleId:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// 🔹 POST /analysis/llm01/scrape/:articleId (Test endpoint)
router.post("/scrape/:articleId", async (req, res) => {
  console.log(`- in POST /analysis/llm01/scrape/:articleId`);

  try {
    const { articleId } = req.params;
    console.log(`articleId: ${articleId}`);

    // Step 1: Get article from database
    const article = await Article.findByPk(articleId);

    if (!article) {
      return res.status(404).json({
        result: false,
        message: `Article not found with ID: ${articleId}`,
      });
    }

    const { url, title } = article;
    console.log(`Testing scrape for article: ${title}`);
    console.log(`URL: ${url}`);

    // Step 2: Attempt to scrape
    const startTime = Date.now();
    let scrapedContent = null;
    let error = null;

    try {
      scrapedContent = await scrapeArticle(url);
    } catch (err) {
      error = {
        message: err.message,
        stack: err.stack,
      };
    }

    const duration = Date.now() - startTime;

    // Step 3: Return detailed results
    res.status(200).json({
      result: true,
      article: {
        id: articleId,
        title: title,
        url: url,
      },
      scraping: {
        success: scrapedContent !== null,
        duration: `${duration}ms`,
        contentLength: scrapedContent ? scrapedContent.length : 0,
        content: scrapedContent,
        error: error,
      },
    });
  } catch (error) {
    console.error("Error in POST /analysis/llm01/scrape/:articleId:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
      stack: error.stack,
    });
  }
});

module.exports = router;
