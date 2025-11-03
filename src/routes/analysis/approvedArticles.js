var express = require("express");
var router = express.Router();
const { Article, State, ArticleApproved } = require("newsnexusdb09");
const { authenticateToken } = require("../../modules/userAuthentication");
const { getDateOfLastSubmittedReport } = require("../../modules/reports");

// 🔹 GET /analysis/approved-articles/by-state
router.get("/by-state", authenticateToken, async (req, res) => {
  try {
    const lastReportDate = await getDateOfLastSubmittedReport();
    const currentMonth = new Date().toLocaleString("en-US", {
      month: "long",
    });
    const stateCountsThisMonth = {};

    const approvedArticlesArray = await ArticleApproved.findAll({
      include: [
        {
          model: Article,
          include: [
            {
              model: State,
            },
          ],
        },
      ],
    });
    // console.log(approvedArticlesArray[0]);
    const unassignedArticlesArray = [];
    const stateCounts = {};
    const stateCountsSinceLastReport = {};

    for (const approved of approvedArticlesArray) {
      const article = approved.Article;
      let stateName = "Unassigned";

      if (article && article.States && article.States.length > 0) {
        stateName = article.States[0].name;
      } else {
        // console.log(article);
        unassignedArticlesArray.push(article);
      }

      // All-time count
      stateCounts[stateName] = (stateCounts[stateName] || 0) + 1;

      // Since-last-report count
      if (
        lastReportDate &&
        new Date(approved.createdAt) > new Date(lastReportDate)
      ) {
        stateCountsSinceLastReport[stateName] =
          (stateCountsSinceLastReport[stateName] || 0) + 1;
      }

      // Current month count
      const approvedDate = new Date(approved.createdAt);
      const now = new Date();
      const sameMonth =
        approvedDate.getMonth() === now.getMonth() &&
        approvedDate.getFullYear() === now.getFullYear();

      if (sameMonth) {
        stateCountsThisMonth[stateName] =
          (stateCountsThisMonth[stateName] || 0) + 1;
      }
    }

    const sumOfApproved = Object.values(stateCounts).reduce(
      (sum, val) => sum + val,
      0
    );

    const articleCountByStateArray = Object.entries(stateCounts).map(
      ([state, count]) => ({
        State: state,
        Count: count,
        [currentMonth]: stateCountsThisMonth[state] || 0,
        "Count since last report": stateCountsSinceLastReport[state] || 0,
      })
    );

    // Add sum row
    articleCountByStateArray.push({
      State: "Total",
      Count: sumOfApproved,
      [currentMonth]: Object.values(stateCountsThisMonth).reduce(
        (sum, val) => sum + val,
        0
      ),
      "Count since last report": Object.values(
        stateCountsSinceLastReport
      ).reduce((sum, val) => sum + val, 0),
    });

    // Separate total row
    const totalRow = articleCountByStateArray.pop();

    // Sort remaining rows by "Count" descending
    articleCountByStateArray.sort((a, b) => b["Count"] - a["Count"]);

    // Reattach total row
    articleCountByStateArray.push(totalRow);

    res.json({ articleCountByStateArray, unassignedArticlesArray });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
