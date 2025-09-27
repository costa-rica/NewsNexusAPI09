const {
	ArticleApproved,
	Article,
	ArticleReportContract,
	ArticleStateContract,
	State,
} = require("newsnexusdb09");

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

module.exports = {
	makeArticleApprovedsTableDictionary
};