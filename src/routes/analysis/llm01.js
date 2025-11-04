var express = require("express");
var router = express.Router();
const { Article } = require("newsnexusdb09");
const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");

// 🔹 POST /analysis/llm01/:articleId
router.post("/:articleId", async (req, res) => {
  console.log(`- in POST /analysis/llm01/:articleId`);

  try {
    const { articleId } = req.params;
    console.log(`articleId: ${articleId}`);

    // Step 1: Get article from database
    const article = await Article.findByPk(articleId);

    if (!article) {
      return res.status(404).json({
        result: false,
        message: `Article not found with ID: ${articleId}`,
      });
    }

    const { title, description } = article;
    console.log(`Article found: ${title}`);

    // Step 2: Read the template file
    const templatePath = path.join(
      __dirname,
      "../../templates/prompt-markdown/prompt02.md"
    );
    let promptTemplate;

    try {
      promptTemplate = await fs.readFile(templatePath, "utf-8");
    } catch (error) {
      console.error("Error reading template file:", error);
      return res.status(500).json({
        result: false,
        message: "Error reading template file",
        error: error.message,
      });
    }

    // Step 3: Replace placeholders in template
    const prompt = promptTemplate
      .replace(/<< ARTICLE_TITLE >>/g, title || "")
      .replace(/<< ARTICLE_DESCRIPTION >>/g, description || "");

    // Step 4: Call OpenAI API
    const openAiApiKey = process.env.KEY_OPEN_AI;
    if (!openAiApiKey) {
      return res.status(500).json({
        result: false,
        message: "KEY_OPEN_AI environment variable not configured",
      });
    }

    let aiResponse;
    let aiError = null;

    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0,
          max_tokens: 100,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiApiKey}`,
          },
        }
      );

      aiResponse = response.data;
      console.log("OpenAI API response received");
    } catch (error) {
      console.error("Error calling OpenAI API:", error.message);
      aiError = error.message;

      // If OpenAI fails, return error immediately (no response to save)
      return res.status(500).json({
        result: false,
        message: "Error calling OpenAI API",
        error: error.message,
      });
    }

    // Step 5: Save response to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${articleId}_${timestamp}.json`;
    const responsesDir = path.join(
      process.env.PATH_PROJECT_RESOURCES,
      "llm-01/responses"
    );
    const filePath = path.join(responsesDir, fileName);

    let fileSaveError = null;

    try {
      // Create directory if it doesn't exist
      await fs.mkdir(responsesDir, { recursive: true });

      // Write the response to file
      await fs.writeFile(filePath, JSON.stringify(aiResponse, null, 2), "utf-8");
      console.log(`Response saved to: ${filePath}`);
    } catch (error) {
      console.error("Error saving response to file:", error);
      fileSaveError = error.message;
    }

    // Step 6: Return response
    if (fileSaveError) {
      return res.status(200).json({
        result: true,
        message: "OpenAI response received but file save failed",
        aiResponse: aiResponse,
        filePath: null,
        fileError: fileSaveError,
      });
    }

    res.status(200).json({
      result: true,
      message: "Successfully processed article with OpenAI",
      aiResponse: aiResponse,
      filePath: filePath,
    });
  } catch (error) {
    console.error("Error in POST /analysis/llm01/:articleId:", error);
    res.status(500).json({
      result: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
