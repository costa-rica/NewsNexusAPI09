require("dotenv").config();
const { initModels, sequelize } = require("newsnexusdb09");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
var adminDbRouter = require("./routes/adminDb");
var keywordsRouter = require("./routes/keywords");
var gNewsRouter = require("./routes/newsOrgs/gNews");
var newsAggregatorsRouter = require("./routes/newsAggregators");
var newsApiRouter = require("./routes/newsOrgs/newsApi");
var articlesRouter = require("./routes/articles");
var statesRouter = require("./routes/state");
var websiteDomainsRouter = require("./routes/websiteDomains");
var reportsRouter = require("./routes/reports");
var automationsRouter = require("./routes/newsOrgs/automations");
var artificialIntelligenceRouter = require("./routes/artificialIntelligence");
var newsDataIoRouter = require("./routes/newsOrgs/newsDataIo");
// var analysisRouter = require("./routes/analysis");
// var deduperRouter = require("./routes/deduper");
var analysisApprovedArticlesRouter = require("./routes/analysis/approvedArticles");
var analysisDeduperRouter = require("./routes/analysis/deduper");
var analysisLlm01Router = require("./routes/analysis/llm01");
var downloadsRouter = require("./routes/downloads");

var app = express();
const cors = require("cors");
// app.use(cors());
app.use(
  cors({
    credentials: true,
    exposedHeaders: ["Content-Disposition"], // <-- this line is key
  })
);

app.use(logger("dev"));
// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "10mb" })); // adjust as needed
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
// Increase body size limits

app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/admin-db", adminDbRouter);
app.use("/keywords", keywordsRouter);
app.use("/gnews", gNewsRouter);
app.use("/news-aggregators", newsAggregatorsRouter);
app.use("/news-api", newsApiRouter);
app.use("/articles", articlesRouter);
app.use("/states", statesRouter);
app.use("/website-domains", websiteDomainsRouter);
app.use("/reports", reportsRouter);
app.use("/automations", automationsRouter);
app.use("/artificial-intelligence", artificialIntelligenceRouter);
app.use("/news-data-io", newsDataIoRouter);
// app.use("/analysis", analysisRouter);
// app.use("/deduper", deduperRouter);
app.use("/analysis/approved-articles", analysisApprovedArticlesRouter);
app.use("/analysis/deduper", analysisDeduperRouter);
app.use("/analysis/llm01", analysisLlm01Router);
app.use("/downloads", downloadsRouter);

initModels();

const {
  onStartUpCreateEnvUsers,
  verifyCheckDirectoryExists,
} = require("./modules/onStartUp");
// Sync database and start server
sequelize
  .sync()
  .then(async () => {
    if (process.env.NODE_ENV !== "test") {
      console.log("✅ Database connected & synced");
      await onStartUpCreateEnvUsers(); // <-- Call function here
      verifyCheckDirectoryExists();
    }
  })
  .catch((error) => console.error("Error syncing database:", error));

module.exports = app;
