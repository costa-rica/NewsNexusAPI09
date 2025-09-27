var express = require("express");
var router = express.Router();
const { ArticleReportContract, ArticleDuplicateAnalysis } = require("newsnexusdb09");
const { authenticateToken } = require("../modules/userAuthentication");
const { makeArticleApprovedsTableDictionary } = require("../modules/deduper");

// 🔹 POST /deduper/report-checker-table
router.post("/report-checker-table", authenticateToken, async (req, res) => {
	console.log(`- in POST /deduper/report-checker-table`);

	try {
		const { reportId, embeddingThresholdMinimum } = req.body;
		console.log(
			`reportId: ${reportId}, embeddingThresholdMinimum: ${embeddingThresholdMinimum}`
		);

		console.log("Step 1: Getting articleApprovedsTableDictionary...");
		// Get the articleApprovedsTableDictionary
		const articleApprovedsTableDictionary =
			await makeArticleApprovedsTableDictionary();
		console.log("Step 1 completed successfully");

		console.log("Step 2: Getting articleReportContracts...");
		// Get all articles associated with this report
		const articleReportContracts = await ArticleReportContract.findAll({
			where: {
				reportId: reportId,
			},
		});
		console.log(`Step 2 completed: Found ${articleReportContracts.length} contracts`);

		// Build the reportArticleDictionary using articleIds from the report
		const reportArticleDictionary = {};

		for (const contract of articleReportContracts) {
			const articleId = contract.articleId;
			console.log(`Step 3: Processing articleId ${articleId}...`);

			// Get the article data from articleApprovedsTableDictionary
			const newArticleInformation = articleApprovedsTableDictionary[articleId] || null;

			console.log(`Step 4: Querying ArticleDuplicateAnalysis for articleId ${articleId}...`);
			// Get all ArticleDuplicateAnalysis entries for this articleId (as articleIdNew)
			// Exclude self-matches where sameArticleIdFlag = 1
			const duplicateAnalysisEntries = await ArticleDuplicateAnalysis.findAll({
				where: {
					articleIdNew: articleId,
					sameArticleIdFlag: 0  // Exclude self-matches
				},
				attributes: ['articleIdApproved', 'embeddingSearch']
			});
			console.log(`Step 4 completed: Found ${duplicateAnalysisEntries.length} duplicate analysis entries`);

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
					approvedArticlesArray.push(entry.articleIdApproved);
				}
			}

			// Build the new structure for this articleId
			reportArticleDictionary[articleId] = {
				maxEmbedding: maxEmbedding,
				newArticleInformation: newArticleInformation,
				approvedArticlesArray: approvedArticlesArray
			};
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
