var express = require("express");
var router = express.Router();
const { ArticleReportContract } = require("newsnexusdb09");
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

			// Add the article data from articleApprovedsTableDictionary if it exists
			if (articleApprovedsTableDictionary[articleId]) {
				reportArticleDictionary[articleId] =
					articleApprovedsTableDictionary[articleId];
			}
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
