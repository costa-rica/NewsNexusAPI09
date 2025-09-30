![Logo](./docs/images/logoAndNameRound.png)

The API for the NewsNexusDb09 and microservices suite of applications.

## installs

```
npm install
```

`npm i dotenv express sequelize sqlite3 bcrypt jsonwebtoken cors cookie-parser morgan luxon archiver json2csv csv-parser multer unzipper exceljs pdfkit axios`

## Documentation

- [News Nexus 09 Overview](./docs/NEWS_NEXUS_09.md)
- [Database documentation](./docs/DATABASE_OVERVIEW.md)
- [API Reference - News Nexus Python Queuer 01](./docs/API_REFERENCE_PYTHON_QUEUER_01.md)

## .env

```
APP_NAME=NewsNexus09
JWT_SECRET=NewsNexus09_SECRET
NAME_DB=newsnexus09.db
PATH_DATABASE=/home/shared/databases/NewsNexus09/
PATH_DB_BACKUPS=/home/shared/project_resources/NewsNexus09/db_backups
PATH_PROJECT_RESOURCES=/home/shared/project_resources/NewsNexus09
PATH_PROJECT_RESOURCES_REPORTS=/home/shared/project_resources/NewsNexus09/reports
PATH_TO_API_RESPONSE_JSON_FILES=/home/shared/project_resources/NewsNexus09/api_response_json_files
PATH_TO_AUTOMATION_EXCEL_FILES=/home/shared/project_resources/NewsNexus09/utilities/automation_excel_files
PATH_TO_UTILITIES_ANALYSIS_SPREADSHEETS=/home/shared/project_resources/NewsNexus09/utilities/analysis_spreadsheets
PATH_TO_UTILITIES_DEDUPER=/Users/nick/Documents/_project_resources/NewsNexus09/utilities/deduper
URL_BASE_NEWS_NEXUS_PYTHON_QUEUER=http://127.0.0.1:5000/
ADMIN_EMAIL_CREATE_ON_STARTUP=["nickrodriguez@kineticmetrics.com"]
NODE_ENV=production
AUTHENTIFICATION_TURNED_OFF=false
ACTIVATE_API_REQUESTS_TO_OUTSIDE_SOURCES=true
```

## API Requests

### NewsAPI

`https://newsapi.org/v2/everything?q=consumer%20product%20safety&from=2025-01-01&to=2025-04-12&pageSize=8&language=en&apiKey=<key>`

### GNews

`https://gnews.io/api/v4/search?q=product%20recall&from=2025-03-01&to=2025-04-14&max=10&lang=en&token=<key>`

## API Endpoints

### POST /artificial-intelligence/add-entity

To add a new Artificial Intelligence entity. This will add to the ArtificialIntelligence table and create a new EntityWhoCategorizedArticle record. Both necessary to track the articles scores created by the AI.

- body:

```json
{
	"name": "NewsNexusZeroShotClassifier01",
	"huggingFaceModelName": "Xenova/bart-large-mnli",
	"huggingFaceModelType": "zero-shot-classification"
}
```

## References

- [News Nexus 09 Overview](./docs/NEWS_NEXUS_09.md)
- [Database documentation](./docs/DATABASE_OVERVIEW.md)
