var express = require("express");
var router = express.Router();
const {
  sequelize,
  ArtificialIntelligence,
  EntityWhoCategorizedArticle,
} = require("newsnexusdb09");
const { authenticateToken } = require("../../modules/userAuthentication");

// 🔹 GET /analysis/llm02/no-article-approved-rows
router.get("/no-article-approved-rows", authenticateToken, async (req, res) => {
  console.log(`- in GET /analysis/llm02/no-article-approved-rows`);

  try {
    // Query to find articles that have NO corresponding row in ArticleApproveds
    // Returns up to 10,000 of the latest articles (ordered by id DESC)
    const sql = `
      SELECT
        a.id,
        a.title,
        a.description,
        a.url,
        a."urlToImage",
        a."publishedDate",
        a."createdAt",
        a."updatedAt"
      FROM "Articles" a
      LEFT JOIN "ArticleApproveds" aa ON aa."articleId" = a.id
      WHERE aa.id IS NULL
      ORDER BY a.id DESC
      LIMIT 10000;
    `;

    const articles = await sequelize.query(sql, {
      type: sequelize.QueryTypes.SELECT,
    });

    console.log(`Found ${articles.length} articles without approval rows`);

    res.status(200).json({
      result: true,
      count: articles.length,
      articles: articles,
    });
  } catch (error) {
    console.error(
      "Error in GET /analysis/llm02/no-article-approved-rows:",
      error
    );
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// 🔹 POST /analysis/llm02/service-login
router.post("/service-login", authenticateToken, async (req, res) => {
  console.log(`- in POST /analysis/llm02/service-login`);

  try {
    const { name } = req.body;

    // Validate request body
    if (!name) {
      return res.status(400).json({
        result: false,
        message: "Missing required field: name",
      });
    }

    console.log(`Looking up AI entity with name: ${name}`);

    // Query ArtificialIntelligence table with the provided name
    const aiModel = await ArtificialIntelligence.findOne({
      where: {
        name: name,
      },
      include: [
        {
          model: EntityWhoCategorizedArticle,
          as: "EntityWhoCategorizedArticles",
        },
      ],
    });

    // Check if AI entity exists
    if (!aiModel) {
      return res.status(404).json({
        result: false,
        message: `AI entity with name "${name}" not found in database`,
      });
    }

    // Get the associated EntityWhoCategorizedArticle
    const entity = aiModel?.EntityWhoCategorizedArticles?.[0];
    if (!entity) {
      return res.status(404).json({
        result: false,
        message: `No EntityWhoCategorizedArticle associated with AI entity "${name}"`,
      });
    }

    console.log(
      `Found entityWhoCategorizesId: ${entity.id} for AI entity: ${aiModel.name}`
    );

    // Return the entityWhoCategorizesId
    res.status(200).json({
      result: true,
      name: aiModel.name,
      entityWhoCategorizesId: entity.id,
    });
  } catch (error) {
    console.error("Error in POST /analysis/llm02/service-login:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
