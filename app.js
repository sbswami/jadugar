const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const dotenv = require("dotenv");
const cors = require('cors');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
app.use(cors())

app.use(express.json());

const upload = multer();

// Configuration
const API_KEY = process.env.OPENAI_API_KEY;
const headers = {
  "Content-Type": "application/json",
  "api-key": API_KEY
};
const ENDPOINT =
  "https://flobizproduction.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-02-15-preview";
const promptContent = fs.readFileSync(path.join(__dirname, "prompt"), "utf8");

app.post("/onboard", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    const encodedImage = req.file.buffer.toString("base64");
    const payload = {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptContent },
            {
              type: "image_url",
              image_url: { url: `data:${req.file.mimetype};base64,${encodedImage}` }
            }
          ]
        }
      ],
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 2000
    };

    const response = await axios.post(ENDPOINT, payload, { headers });

    const choices = response.data.choices;

    if (choices && choices.length > 0) {
      const firstChoice = choices[0];
      const messageContent = firstChoice.message.content;

      const jsonMatch = messageContent.match(/```json([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        const jsonResponse = JSON.parse(jsonMatch[1]);
        res.json(jsonResponse);
      } else {
        res.status(500).json({ error: "Failed to extract JSON from AI response" });
      }
    } else {
      res.json({ content: "No response generated." });
    }
  } catch (error) {
    console.error(`Failed to process the image. Error: ${error.message}`);
    res.status(500).json({ error: `Failed to process the image. Error: ${error.message}` });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
