const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const base64 = require("base64-js");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Configuration
const API_KEY = process.env.OPENAI_API_KEY;

const headers = {
  "Content-Type": "application/json",
  "api-key": API_KEY
};

const ENDPOINT =
  "https://flobizproduction.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-02-15-preview";

// Change the route to POST and rename it
app.post("/process-image", upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    const encodedImage = req.file.buffer.toString('base64');

    const payload = {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: fs.readFileSync(path.join(__dirname, "prompt"), "utf8") },
            { type: "image_url", image_url: { url: `data:${req.file.mimetype};base64,${encodedImage}` } }
          ]
        }
      ],
      temperature: 0.6,
      top_p: 0.95,
      max_tokens: 2000
    };

    const response = await axios.post(ENDPOINT, payload, { headers });

    // Extract the choices array from the response
    const choices = response.data.choices;

    // Check if choices array exists and has content
    if (choices && choices.length > 0) {
      // Get the first choice (usually the best one)
      const firstChoice = choices[0];

      // Extract the message content from the first choice
      const messageContent = firstChoice.message.content;

      // Extract JSON part from the AI response
      const jsonMatch = messageContent.match(/```json([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        const jsonResponse = JSON.parse(jsonMatch[1]);
        res.json(jsonResponse);
      } else {
        res.status(500).json({ error: "Failed to extract JSON from AI response" });
      }
    } else {
      console.log("No choices returned from the API");
      res.json({ content: "No response generated." });
    }
  } catch (error) {
    res.status(500).send(`Failed to process the image. Error: ${error.message}`);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
