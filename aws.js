const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const dotenv = require("dotenv");
const AWS = require("aws-sdk");
const uuid = require("uuid");
const { fromBuffer } = require("pdf2pic");

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB limit

// Validate critical environment variables
const { ACCESS_KEY, SECRET_KEY, PORT } = process.env;
if (!ACCESS_KEY || !SECRET_KEY) {
  throw new Error("Missing AWS credentials in environment variables.");
}

// Configure AWS SDK
AWS.config.update({
  region: "us-east-1",
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY
  }
});

// Create Bedrock Runtime client
const bedrockRuntime = new AWS.BedrockRuntime();

// Route for onboarding with file upload
app.post("/onboard", upload.single("file"), async (req, res) => {
  const { supplier } = req.body;

  let promptContent;
  if (supplier) {
    promptContent = fs.readFileSync(path.join(__dirname, "supplier"), "utf8");
  } else {
    promptContent = fs.readFileSync(path.join(__dirname, "main_prompt"), "utf8");
  }

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    let base64Image;
    let mimeType;

    // Validate and process PDF or image
    if (req.file.mimetype === "application/pdf") {
      const pdfImage = await convertPdfToImage(req.file.buffer);
      base64Image = pdfImage;
      mimeType = "image/png"; // Assume PNG for converted PDFs
    } else if (req.file.mimetype.startsWith("image/")) {
      base64Image = req.file.buffer.toString("base64");
      mimeType = req.file.mimetype;
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    // Invoke LLM with the prompt and image
    const response = await invokeLLM(promptContent, base64Image, mimeType);

    // Parse and send response
    try {
      const jsonResponse = JSON.parse(response);
      res.json(jsonResponse);
    } catch (jsonError) {
      res.json({ content: response });
    }
  } catch (error) {
    console.error(`Failed to process the file. Error: ${error.message}`);
    res.status(500).json({ error: `Failed to process the file. Error: ${error.message}` });
  }
});

// Function to invoke Bedrock's LLM
async function invokeLLM(prompt, base64Image, mimeType) {
  // Validate inputs
  if (!base64Image) {
    throw new Error("Missing Base64-encoded image data.");
  }

  if (!prompt) {
    throw new Error("Missing prompt content.");
  }

  const params = {
    modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      max_tokens: 3500,
      anthropic_version: "bedrock-2023-05-31",
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

    if (!responseBody.content || !responseBody.content[0]) {
      throw new Error("Unexpected response format from Bedrock model.");
    }

    return responseBody.content[0].text;
  } catch (error) {
    console.error("Error invoking Bedrock model:", error);
    throw new Error("Failed to invoke Bedrock model.");
  }
}

// Function to convert PDF to image (using Ghostscript)
async function convertPdfToImage(pdfBuffer) {
  try {
    const options = {
      density: 100,
      saveFilename: "untitled",
      format: "png",
      preserveAspectRatio: true,
      quality: 80
    };

    const convert = fromBuffer(pdfBuffer, options);
    const pageToConvertAsImage = 1;

    const result = await convert(pageToConvertAsImage);

    if (!result.toString("base64")) {
      throw new Error("Failed to generate Base64 image data from PDF.");
    }

    // Read the image file as a buffer
    const imageBuffer = await fs.readFileSync(result.path);

    // Convert the image buffer to a Base64 string
    const base64Image = imageBuffer.toString("base64");

    fs.unlinkSync(result.path); // Delete the temporary image file
    return base64Image;
  } catch (error) {
    if (
      error.message.includes("Postscript delegate failed") ||
      error.message.includes("gs: command not found")
    ) {
      throw new Error(
        "Ghostscript is required for PDF conversion but was not found. Please install Ghostscript."
      );
    }
    console.error("Error converting PDF to image:", error);
    throw error;
  }
}

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
