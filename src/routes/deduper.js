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

// 🔹 POST /deduper/report-checker-table
router.post("/report-checker-table", authenticateToken, async (req, res) => {
	console.log(`- in POST /deduper/report-checker-table`);

	try {
		const { reportId, embeddingThresholdMinimum } = req.body;
		console.log(
			`reportId: ${reportId}, embeddingThresholdMinimum: ${embeddingThresholdMinimum}`
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

		// Build the reportArticleDictionary using articleIds from the report
		const reportArticleDictionary = {};

		for (const contract of articleReportContracts) {
			const articleId = contract.articleId;

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
				newArticleInformation: newArticleInformation,
				approvedArticlesArray: approvedArticlesArray,
			};
		}

		// Create the deduper analysis Excel file
		try {
			const excelFilePath = await createDeduperAnalysis(
				reportArticleDictionary
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

module.exports = router;
