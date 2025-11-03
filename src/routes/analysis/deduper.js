var express = require("express");
var router = express.Router();
const {
  ArticleReportContract,
  ArticleDuplicateAnalysis,
} = require("newsnexusdb09");
const { authenticateToken } = require("../../modules/userAuthentication");
const {
  makeArticleApprovedsTableDictionary,
  createDeduperAnalysis,
} = require("../../modules/analysis/deduper");
const axios = require("axios");

// 🔹 POST /deduper/report-checker-table
router.post("/report-checker-table", authenticateToken, async (req, res) => {
  console.log(`- in POST /deduper/report-checker-table`);

  try {
    const { reportId, embeddingThresholdMinimum, spacerRow } = req.body;
    console.log(
      `reportId: ${reportId}, embeddingThresholdMinimum: ${embeddingThresholdMinimum}, spacerRow: ${spacerRow}`
    );

    // Get the articleApprovedsTableDictionary
    const articleApprovedsTableDictionary =
      await makeArticleApprovedsTableDictionary();

    // Get all articles associated with this report
    const articleReportContracts = await ArticleReportContract.findAll({
      where: {
        reportId: reportId,
      },
    });

    // Build a map of articleId to reference number for quick lookup
    // Query ALL ArticleReportContract records to get reference numbers for all articles
    const allArticleReportContracts = await ArticleReportContract.findAll({
      order: [["reportId", "DESC"]], // Order by reportId descending to get latest first
    });

    // Build map, keeping only the first (latest) reference number for each articleId
    const articleIdToRefNumberMap = {};
    for (const contract of allArticleReportContracts) {
      // Only set if not already set (since we're ordering by reportId DESC, first occurrence is latest)
      if (!articleIdToRefNumberMap[contract.articleId]) {
        articleIdToRefNumberMap[contract.articleId] =
          contract.articleReferenceNumberInReport;
      }
    }

    // Build the reportArticleDictionary using articleIds from the report
    const reportArticleDictionary = {};

    for (const contract of articleReportContracts) {
      const articleId = contract.articleId;
      const articleReferenceNumberInReport =
        contract.articleReferenceNumberInReport;

      // Get the article data from articleApprovedsTableDictionary
      const newArticleInformation = articleApprovedsTableDictionary[articleId]
        ? {
            ...articleApprovedsTableDictionary[articleId],
            articleReportRefIdNew: articleReferenceNumberInReport,
          }
        : null;

      // Get all ArticleDuplicateAnalysis entries for this articleId (as articleIdNew)
      // Exclude self-matches where sameArticleIdFlag = 1
      const duplicateAnalysisEntries = await ArticleDuplicateAnalysis.findAll({
        where: {
          articleIdNew: articleId,
          sameArticleIdFlag: 0, // Exclude self-matches
        },
        attributes: ["articleIdApproved", "embeddingSearch"],
      });

      // Calculate maxEmbedding and filter approvedArticlesArray by threshold
      let maxEmbedding = 0;
      const approvedArticlesArray = [];

      for (const entry of duplicateAnalysisEntries) {
        const embeddingSearch = entry.embeddingSearch || 0;

        // Update maxEmbedding
        if (embeddingSearch > maxEmbedding) {
          maxEmbedding = embeddingSearch;
        }

        // Add articleIdApproved to approvedArticlesArray if above threshold
        if (embeddingSearch >= embeddingThresholdMinimum) {
          approvedArticlesArray.push({
            articleIdApproved: entry.articleIdApproved,
            embeddingSearch: embeddingSearch,
            articleReportRefIdApproved:
              articleIdToRefNumberMap[entry.articleIdApproved] || null,
            ...articleApprovedsTableDictionary[entry.articleIdApproved],
          });
        }
      }

      // Sort approvedArticlesArray by embeddingSearch in descending order
      approvedArticlesArray.sort(
        (a, b) => b.embeddingSearch - a.embeddingSearch
      );

      // Build the new structure for this articleId
      reportArticleDictionary[articleId] = {
        maxEmbedding: maxEmbedding,
        articleReferenceNumberInReport: articleReferenceNumberInReport,
        newArticleInformation: newArticleInformation,
        approvedArticlesArray: approvedArticlesArray,
      };
    }

    // Create the deduper analysis Excel file
    try {
      const excelFilePath = await createDeduperAnalysis(
        reportArticleDictionary,
        articleIdToRefNumberMap,
        spacerRow
      );
      console.log("Deduper analysis Excel file created:", excelFilePath);
    } catch (error) {
      console.error("Error creating deduper analysis Excel file:", error);
      // Don't fail the main request if Excel creation fails
    }

    res.json({
      length: Object.keys(reportArticleDictionary).length,
      reportArticleDictionary,
    });
  } catch (error) {
    console.error("Error in POST /deduper/report-checker-table:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// 🔹 GET /deduper/request-job/:reportId
router.get("/request-job/:reportId", authenticateToken, async (req, res) => {
  console.log(`- in GET /deduper/request-job/:reportId`);

  try {
    const { reportId } = req.params;
    console.log(`reportId: ${reportId}`);

    // Validate that the report exists and has articles
    const articleReportContracts = await ArticleReportContract.findAll({
      where: {
        reportId: reportId,
      },
      attributes: ["articleId"],
    });

    if (articleReportContracts.length === 0) {
      return res.status(404).json({
        result: false,
        message: `No articles found for reportId: ${reportId}`,
      });
    }

    console.log(
      `Found ${articleReportContracts.length} articles for reportId ${reportId}`
    );

    // Get Python Queuer base URL from environment
    const pythonQueuerBaseUrl = process.env.URL_BASE_NEWS_NEXUS_PYTHON_QUEUER;
    if (!pythonQueuerBaseUrl) {
      return res.status(500).json({
        result: false,
        message:
          "URL_BASE_NEWS_NEXUS_PYTHON_QUEUER environment variable not configured",
      });
    }

    // Build the URL for the new reportId-specific endpoint
    const pythonQueuerUrl = `${pythonQueuerBaseUrl}deduper/jobs/reportId/${reportId}`;
    console.log(`Sending request to: ${pythonQueuerUrl}`);

    // Send GET request to NewsNexusPythonQueuer
    const response = await axios.get(pythonQueuerUrl);
    console.log(
      `Python Queuer response:`,
      JSON.stringify(response.data, null, 2)
    );

    // Return success with the Python Queuer response
    res.status(201).json({
      result: true,
      message: "Job request successful",
      articleCount: articleReportContracts.length,
      pythonQueuerResponse: response.data,
    });
  } catch (error) {
    console.error("Error in GET /deduper/request-job/:reportId:", error);

    // If it's an Axios error with a response, include that information
    if (error.response) {
      return res.status(error.response.status || 500).json({
        result: false,
        message: "Error creating job via Python Queuer",
        error: error.message,
        pythonQueuerResponse: error.response.data,
      });
    }

    // Generic error response
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// 🔹 GET /deduper/job-list-status
router.get("/job-list-status", authenticateToken, async (req, res) => {
  console.log(`- in GET /deduper/job-list-status`);

  try {
    // Get Python Queuer base URL from environment
    const pythonQueuerBaseUrl = process.env.URL_BASE_NEWS_NEXUS_PYTHON_QUEUER;
    if (!pythonQueuerBaseUrl) {
      return res.status(500).json({
        result: false,
        message:
          "URL_BASE_NEWS_NEXUS_PYTHON_QUEUER environment variable not configured",
      });
    }

    // Build the URL for the jobs/list endpoint
    const jobsListUrl = `${pythonQueuerBaseUrl}deduper/jobs/list`;
    console.log(`Sending GET request to: ${jobsListUrl}`);

    // Make GET request to Python Queuer
    const response = await axios.get(jobsListUrl);
    console.log(
      `Python Queuer response:`,
      JSON.stringify(response.data, null, 2)
    );

    // Return the response from Python Queuer
    res.json(response.data);
  } catch (error) {
    console.error("Error in GET /deduper/job-list-status:", error);

    // If it's an Axios error with a response, include that information
    if (error.response) {
      return res.status(error.response.status || 500).json({
        result: false,
        message: "Error fetching job list from Python Queuer",
        error: error.message,
        pythonQueuerResponse: error.response.data,
      });
    }

    // Generic error response
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// 🔹 DELETE /deduper/clear-article-duplicate-analyses-table
router.delete(
  "/clear-article-duplicate-analyses-table",
  authenticateToken,
  async (req, res) => {
    console.log(`- in DELETE /deduper/clear-article-duplicate-analyses-table`);

    try {
      // Get Python Queuer base URL from environment
      const pythonQueuerBaseUrl = process.env.URL_BASE_NEWS_NEXUS_PYTHON_QUEUER;
      if (!pythonQueuerBaseUrl) {
        return res.status(500).json({
          result: false,
          message:
            "URL_BASE_NEWS_NEXUS_PYTHON_QUEUER environment variable not configured",
        });
      }

      // Build the URL for the clear-db-table endpoint
      const clearTableUrl = `${pythonQueuerBaseUrl}deduper/clear-db-table`;
      console.log(`Sending DELETE request to: ${clearTableUrl}`);

      // Make DELETE request to Python Queuer
      const response = await axios.delete(clearTableUrl);
      console.log(
        `Python Queuer response:`,
        JSON.stringify(response.data, null, 2)
      );

      // Return the response from Python Queuer
      res.json({
        result: true,
        message: "Article duplicate analyses table cleared successfully",
        pythonQueuerResponse: response.data,
      });
    } catch (error) {
      console.error(
        "Error in DELETE /deduper/clear-article-duplicate-analyses-table:",
        error
      );

      // If it's an Axios error with a response, include that information
      if (error.response) {
        return res.status(error.response.status || 500).json({
          result: false,
          message: "Error clearing table via Python Queuer",
          error: error.message,
          pythonQueuerResponse: error.response.data,
        });
      }

      // Generic error response
      res.status(500).json({
        result: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

// 🔹 GET /deduper/article-duplicate-analyses-status
router.get(
  "/article-duplicate-analyses-status",
  authenticateToken,
  async (req, res) => {
    console.log(`- in GET /deduper/article-duplicate-analyses-status`);

    try {
      // Query the ArticleDuplicateAnalysis table to get any one row with reportId
      const analysisRecord = await ArticleDuplicateAnalysis.findOne({
        attributes: ["reportId"],
      });

      // Determine status and reportId based on query result
      if (analysisRecord && analysisRecord.reportId !== null) {
        // Table is populated
        res.json({
          status: "populated",
          reportId: analysisRecord.reportId,
        });
      } else {
        // Table is empty or no reportId found
        res.json({
          status: "empty",
          reportId: null,
        });
      }
    } catch (error) {
      console.error(
        "Error in GET /deduper/article-duplicate-analyses-status:",
        error
      );
      res.status(500).json({
        result: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

module.exports = router;
