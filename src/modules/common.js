const fs = require("fs");
const path = require("path");
const { DateTime } = require("luxon");
function checkBody(body, keys) {
  let isValid = true;

  for (const field of keys) {
    if (!body[field] || body[field] === "") {
      isValid = false;
    }
  }

  return isValid;
}

function checkBodyReturnMissing(body, keys) {
  let isValid = true;
  let missingKeys = [];

  for (const field of keys) {
    if (!body[field] || body[field] === "") {
      isValid = false;
      missingKeys.push(field);
    }
  }

  return { isValid, missingKeys };
}

function writeRequestArgs(requestBody, fileNameSuffix) {
  // 🔹 Write request arguments to a JSON file
  const testDir = process.env.PATH_TEST_REQUEST_ARGS;
  if (testDir) {
    try {
      // Ensure the directory exists
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      // Generate file name with timestamp
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .split("T")[1]
        .split("Z")[0]; // HHMMSS format
      const filePath = path.join(
        testDir,
        `request_${timestamp}_${fileNameSuffix}.json`
      );

      // Write request body to file
      fs.writeFileSync(filePath, JSON.stringify(requestBody, null, 2), "utf8");
      console.log(`✅ Request arguments saved to: ${filePath}`);
    } catch (err) {
      console.error("❌ Error writing request arguments file:", err);
    }
  } else {
    console.warn(
      "⚠️ PATH_TEST_REQUEST_ARGS is not set, skipping request logging."
    );
  }
}

function writeResponseDataFromNewsAggregator(
  NewsArticleAggregatorSourceId,
  newsApiRequest,
  requestResponseData,
  prefix = false
) {
  const formattedDate = new Date()
    .toISOString()
    .split("T")[0]
    .replace(/-/g, ""); // YYYYMMDD

  const responseDir = process.env.PATH_TO_API_RESPONSE_JSON_FILES;
  const datedDir = path.join(responseDir, formattedDate);

  // ✅ Ensure dated subdirectory exists
  if (!fs.existsSync(datedDir)) {
    fs.mkdirSync(datedDir, { recursive: true });
  }

  // ✅ Remove date from filename
  const responseFilename = prefix
    ? `failedToSave_requestId${newsApiRequest.id}_apiId${NewsArticleAggregatorSourceId}.json`
    : `requestId${newsApiRequest.id}_apiId${NewsArticleAggregatorSourceId}.json`;

  const responseFilePath = path.join(datedDir, responseFilename);

  let jsonToStore = requestResponseData;
  if (newsApiRequest.url) {
    jsonToStore.requestUrl = newsApiRequest.url;
  }

  fs.writeFileSync(
    responseFilePath,
    JSON.stringify(jsonToStore, null, 2),
    "utf-8"
  );
}

// Returns string formatted in Eastern Time
function convertDbUtcDateOrStringToEasternString(input) {
  // NOTE: this is useful for converting article.createdAt dates - if not for database seriously ask why am I using it and not createJavaScriptExcelDateObjectEastCoasUs
  let dt;
  // console.log("input typeof: ");
  // console.log(typeof input);

  if (typeof input === "string") {
    // console.log("-----> input is string");
    const sanitized = input.trim().replace(" ", "T").replace(" +", "+");
    dt = DateTime.fromISO(sanitized, { zone: "utc" });
  } else if (input instanceof Date) {
    dt = DateTime.fromJSDate(input, { zone: "utc" });
  } else {
    return "Invalid";
  }

  // console.log("dt: ");
  // console.log(dt);

  return dt.setZone("America/New_York").toFormat("yyyy-MM-dd HH:mm");
  // return dt.setZone("America/New_York");
}

function getMostRecentEasternFriday() {
  const now = DateTime.now().setZone("America/New_York");
  const daysSinceFriday = (now.weekday + 1) % 7; // Luxon weekday: Mon=1...Sun=7
  return now.minus({ days: daysSinceFriday }).startOf("day").toJSDate();
}

// function getLastThursdayAt20h() {
//   const now = new Date();
//   const result = new Date(now);

//   // Set to today at 20:00
//   result.setHours(20, 0, 0, 0);

//   // Get the current day of the week (0 = Sunday, 1 = Monday, ..., 4 = Thursday, ..., 6 = Saturday)
//   const currentDay = result.getDay();

//   // Calculate how many days to go back to get to Thursday (4)
//   let daysToSubtract = (currentDay - 4 + 7) % 7;
//   if (daysToSubtract === 0 && now < result) {
//     // It's Thursday but before 20h, go back one week
//     daysToSubtract = 7;
//   }

//   result.setDate(result.getDate() - daysToSubtract);
//   return result;
// }

function getLastThursdayAt20hInNyTimeZone() {
  const now = DateTime.now().setZone("America/New_York");

  // Find how many days to subtract to get to the most recent Thursday
  const daysToSubtract = now.weekday >= 5 ? now.weekday - 4 : now.weekday + 3;

  let target = now.minus({ days: daysToSubtract }).set({
    hour: 20,
    minute: 0,
    second: 0,
    millisecond: 0,
  });

  // If it's Thursday but before 20h, subtract an extra 7 days
  if (now.weekday === 4 && now < target) {
    target = target.minus({ days: 7 });
  }

  // Convert to a native JavaScript Date object
  return target.toJSDate();
}

function convertJavaScriptDateToTimezoneString(javascriptDate, tzString) {
  // NOTE: this returns an object (in tzString) with the following properties:
  // dateParts {
  //   month: '06',
  //   literal: ' ',
  //   day: '10',
  //   year: '2025',
  //   hour: '08',
  //   minute: '03',
  //   dayPeriod: 'AM'
  //   dateString: '2025-06-10'
  // }
  const options = {
    timeZone: tzString,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  };
  const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(
    javascriptDate
  );
  const dateParts = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );
  dateParts.dateString = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;

  return dateParts;
}

function createJavaScriptExcelDateObjectEastCoasUs(now = new Date()) {
  // NOTE: only use this for Excel otherwise the date is a bit convoluted
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "short",
  });
  const parts = formatter.formatToParts(now);
  const tzName = parts.find((part) => part.type === "timeZoneName")?.value;
  // NOTE: returns EDT (4 hours back) or EST (3 hours back)
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  if (tzName === "EDT") {
    return fourHoursAgo;
  } else {
    return threeHoursAgo;
  }
}

module.exports = {
  checkBody,
  checkBodyReturnMissing,
  writeRequestArgs,
  writeResponseDataFromNewsAggregator,
  convertDbUtcDateOrStringToEasternString,
  getMostRecentEasternFriday,
  convertJavaScriptDateToTimezoneString,
  createJavaScriptExcelDateObjectEastCoasUs,
  // getLastThursdayAt20h,
  getLastThursdayAt20hInNyTimeZone,
};
