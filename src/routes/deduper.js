var express = require("express");
var router = express.Router();
const {
	ArticleReportContract,
	ArticleDuplicateAnalysis,
} = require("newsnexusdb09");
const { authenticateToken } = require("../modules/userAuthentication");
const {
	makeArticleApprovedsTableDictionary,
	createDeduperAnalysis,
} = require("../modules/deduper");
const fs = require("fs").promises;
const path = require("path");
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
			order: [['reportId', 'DESC']], // Order by reportId descending to get latest first
		});

		// Build map, keeping only the first (latest) reference number for each articleId
		const articleIdToRefNumberMap = {};
		for (const contract of allArticleReportContracts) {
			// Only set if not already set (since we're ordering by reportId DESC, first occurrence is latest)
			if (!articleIdToRefNumberMap[contract.articleId]) {
				articleIdToRefNumberMap[contract.articleId] = contract.articleReferenceNumberInReport;
			}
		}

		// Build the reportArticleDictionary using articleIds from the report
		const reportArticleDictionary = {};

		for (const contract of articleReportContracts) {
			const articleId = contract.articleId;
			const articleReferenceNumberInReport = contract.articleReferenceNumberInReport;

			// Get the article data from articleApprovedsTableDictionary
			const newArticleInformation =
				articleApprovedsTableDictionary[articleId] || null;

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

		// Get all articles associated with this report
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

		// Extract articleIds
		const articleIds = articleReportContracts.map(
			(contract) => contract.articleId
		);
		console.log(`Found ${articleIds.length} articles for reportId ${reportId}`);

		// Create CSV content
		const csvContent = "articleId\n" + articleIds.join("\n");

		// Get path from environment variable
		const deduperPath = process.env.PATH_TO_UTILITIES_DEDUPER;
		if (!deduperPath) {
			return res.status(500).json({
				result: false,
				message: "PATH_TO_UTILITIES_DEDUPER environment variable not configured",
			});
		}

		// Write CSV file
		const csvFilePath = path.join(deduperPath, "article_ids.csv");
		await fs.writeFile(csvFilePath, csvContent, "utf8");
		console.log(`Created CSV file at: ${csvFilePath}`);

		// Send request to NewsNexusPythonQueuer
		const pythonQueuerBaseUrl = process.env.URL_BASE_NEWS_NEXUS_PYTHON_QUEUER;
		if (!pythonQueuerBaseUrl) {
			return res.status(500).json({
				result: false,
				message:
					"URL_BASE_NEWS_NEXUS_PYTHON_QUEUER environment variable not configured",
			});
		}

		const pythonQueuerUrl = `${pythonQueuerBaseUrl}deduper/jobs`;
		console.log(`Sending request to: ${pythonQueuerUrl}`);

		const response = await axios.get(pythonQueuerUrl);
		console.log(
			`Python Queuer response:`,
			JSON.stringify(response.data, null, 2)
		);

		// Return success with both the CSV info and the Python Queuer response
		res.json({
			result: true,
			message: "Job request successful",
			csvFilePath: csvFilePath,
			articleCount: articleIds.length,
			pythonQueuerResponse: response.data,
		});
	} catch (error) {
		console.error("Error in GET /deduper/request-job/:reportId:", error);
		res.status(500).json({
			result: false,
			message: "Internal server error",
			error: error.message,
		});
	}
});

module.exports = router;
