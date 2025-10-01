const {
	ArticleApproved,
	Article,
	ArticleReportContract,
	ArticleStateContract,
	State,
} = require("newsnexusdb09");
const ExcelJS = require("exceljs");
const path = require("path");

/**
 * Creates a dictionary of article data from the ArticleApproveds table
 * with state information added from related tables
 * @returns {Object} Dictionary with articleId as keys and article data as values
 */
async function makeArticleApprovedsTableDictionary() {
	try {
		// Get all ArticleApproveds with their related state information
		// Following path: ArticleApproved → Article → ArticleStateContract → State
		const articleApproveds = await ArticleApproved.findAll({
			include: [
				{
					model: Article,
					include: [
						{
							model: ArticleStateContract,
							include: [
								{
									model: State,
									attributes: ['abbreviation']
								}
							]
						}
					]
				}
			]
		});

		const articleApprovedsTableDictionary = {};

		for (const articleApproved of articleApproveds) {
			const articleId = articleApproved.articleId;

			// Get state abbreviation from the relationship path: ArticleApproved → Article → ArticleStateContract → State
			let state = null;
			if (articleApproved.Article &&
				articleApproved.Article.ArticleStateContracts &&
				articleApproved.Article.ArticleStateContracts.length > 0) {
				const stateContract = articleApproved.Article.ArticleStateContracts[0];
				if (stateContract.State) {
					state = stateContract.State.abbreviation;
				}
			}

			articleApprovedsTableDictionary[articleId] = {
				headlineForPdfReport: articleApproved.headlineForPdfReport,
				publicationNameForPdfReport: articleApproved.publicationNameForPdfReport,
				publicationDateForPdfReport: articleApproved.publicationDateForPdfReport,
				textForPdfReport: articleApproved.textForPdfReport,
				urlForPdfReport: articleApproved.urlForPdfReport,
				state: state
			};
		}

		return articleApprovedsTableDictionary;
	} catch (error) {
		console.error('Error in makeArticleApprovedsTableDictionary:', error);
		throw error;
	}
}

/**
 * Creates an Excel spreadsheet analysis of the reportArticleDictionary
 * @param {Object} reportArticleDictionary - The report article dictionary from the deduper route
 * @param {Object} articleIdToRefNumberMap - Map of articleId to articleReferenceNumberInReport
 * @returns {string} Path to the created Excel file
 */
async function createDeduperAnalysis(reportArticleDictionary, articleIdToRefNumberMap) {
	try {
		if (!reportArticleDictionary || Object.keys(reportArticleDictionary).length === 0) {
			throw new Error("reportArticleDictionary is empty or undefined.");
		}

		// Create workbook and worksheet
		const workbook = new ExcelJS.Workbook();
		const worksheet = workbook.addWorksheet("Deduper Analysis");

		// Define column headers
		const headers = [
			"Id",
			"articleIdNew",
			"articleReportRefIdNew",
			"ArticleIdApproved",
			"articleReportRefIdApproved",
			"embeddingSearch",
			"headlineForPdfReport",
			"publicationNameForPdfReport",
			"publicationDateForPdfReport",
			"textForPdfReport",
			"urlForPdfReport",
			"state"
		];

		// Add headers to worksheet
		worksheet.addRow(headers);

		let rowId = 1;

		// Sort entries by maxEmbedding in descending order
		const sortedEntries = Object.entries(reportArticleDictionary).sort((a, b) => {
			const maxEmbeddingA = a[1].maxEmbedding || 0;
			const maxEmbeddingB = b[1].maxEmbedding || 0;
			return maxEmbeddingB - maxEmbeddingA; // Descending order
		});

		// Process each articleId in sorted order
		for (const [articleIdNew, data] of sortedEntries) {
			const { newArticleInformation, approvedArticlesArray, articleReferenceNumberInReport } = data;

			// Skip if approvedArticlesArray is empty
			if (!approvedArticlesArray || approvedArticlesArray.length === 0) {
				continue;
			}

			// First row: new article information
			if (newArticleInformation) {
				const newArticleRow = [
					rowId++,
					articleIdNew,
					articleReferenceNumberInReport || "",
					articleIdNew, // ArticleIdApproved equals articleIdNew for the first row
					articleReferenceNumberInReport || "", // articleReportRefIdApproved equals articleReportRefIdNew for the first row
					1, // embeddingSearch = 1 for the new article
					newArticleInformation.headlineForPdfReport || "",
					newArticleInformation.publicationNameForPdfReport || "",
					newArticleInformation.publicationDateForPdfReport || "",
					newArticleInformation.textForPdfReport || "",
					newArticleInformation.urlForPdfReport || "",
					newArticleInformation.state || ""
				];
				worksheet.addRow(newArticleRow);
			}

			// Subsequent rows: approved articles array
			for (const approvedArticle of approvedArticlesArray) {
				const approvedRow = [
					rowId++,
					articleIdNew,
					articleReferenceNumberInReport || "",
					approvedArticle.articleIdApproved,
					articleIdToRefNumberMap[approvedArticle.articleIdApproved] || "",
					approvedArticle.embeddingSearch || 0,
					approvedArticle.headlineForPdfReport || "",
					approvedArticle.publicationNameForPdfReport || "",
					approvedArticle.publicationDateForPdfReport || "",
					approvedArticle.textForPdfReport || "",
					approvedArticle.urlForPdfReport || "",
					approvedArticle.state || ""
				];
				worksheet.addRow(approvedRow);
			}
		}

		// Get output directory from environment variable
		const outputDir = process.env.PATH_TO_UTILITIES_ANALYSIS_SPREADSHEETS;
		if (!outputDir) {
			throw new Error("Environment variable PATH_TO_UTILITIES_ANALYSIS_SPREADSHEETS is not set");
		}

		// Create output file path
		const outputFilePath = path.join(outputDir, "deduper_analysis.xlsx");

		// Save the Excel file
		await workbook.xlsx.writeFile(outputFilePath);
		console.log("✅ Deduper analysis Excel file saved to:", outputFilePath);

		return outputFilePath;
	} catch (error) {
		console.error('Error in createDeduperAnalysis:', error);
		throw error;
	}
}

module.exports = {
	makeArticleApprovedsTableDictionary,
	createDeduperAnalysis
};