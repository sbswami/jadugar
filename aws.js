const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const dotenv = require("dotenv");
const AWS = require("aws-sdk");
const uuid = require("uuid");
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
const upload = multer();

// Configure AWS SDK
AWS.config.update({
  region: "us-east-1",
  credentials: new AWS.Credentials({
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_KEY
  })
});

// Create Bedrock Runtime client
const bedrockRuntime = new AWS.BedrockRuntime();

const promptContent = fs.readFileSync(path.join(__dirname, "prompt"), "utf8");

app.post("/onboard", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded" });
    }

    const encodedImage = req.file.buffer.toString("base64");
    const response = await invokeLLMWithImage(promptContent, encodedImage, req.file.mimetype);

    try {
      const jsonResponse = JSON.parse(response);
      res.json(jsonResponse);
    } catch (jsonError) {
      res.json({ content: response });
    }
  } catch (error) {
    console.error(`Failed to process the image. Error: ${error.message}`);
    res.status(500).json({ error: `Failed to process the image. Error: ${error.message}` });
  }
});

async function invokeLLMWithImage(prompt, base64Image, mimeType) {
  const params = {
    modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      max_tokens: 3800,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: base64Image
              }
            },
            {
              type: "text",
              text: prompt
            }
          ]
        }
      ],
      temperature: 0.5,
      top_p: 1,
      top_k: 250
    })
  };

  try {
    const response = await bedrockRuntime.invokeModel(params).promise();
    const responseBody = JSON.parse(response.body);
    return responseBody.content[0].text;
  } catch (error) {
    console.error("Error invoking Bedrock model:", error);
    throw error;
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
