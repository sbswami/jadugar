const router = require("express").Router();

const fs = require("fs");
const path = require("path");
const multer = require("multer");
const AWS = require("aws-sdk");
const { fromBuffer } = require("pdf2pic");
const { getGST } = require("./gpt");

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB limit

// Validate critical environment variables
const { ACCESS_KEY, SECRET_KEY } = process.env;
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

const instructionsOwnBill = fs.readFileSync(
  path.join(__dirname, "../prompts/instructions_main"),
  "utf8"
);
const instructionsSupplierBill = fs.readFileSync(
  path.join(__dirname, "../prompts/instructions_supplier"),
  "utf8"
);

// Route for onboarding with file upload
router.post("/onboard", upload.single("file"), async (req, res) => {
  const supplier = Boolean(req.body.supplier);

  let promptContent1;
  let promptContent2;
  let promptContentFull;

  if (supplier) {
    promptContentFull = fs.readFileSync(path.join(__dirname, "../prompts/supplier_prompt"), "utf8");
    promptContent1 = fs.readFileSync(
      path.join(__dirname, "../prompts/supplier_prompt_part_1"),
      "utf8"
    );
    promptContent2 = fs.readFileSync(
      path.join(__dirname, "../prompts/supplier_prompt_part_2"),
      "utf8"
    );
  } else {
    promptContentFull = fs.readFileSync(path.join(__dirname, "../prompts/main_prompt"), "utf8");
    promptContent1 = fs.readFileSync(path.join(__dirname, "../prompts/main_prompt_part_1"), "utf8");
    promptContent2 = fs.readFileSync(path.join(__dirname, "../prompts/main_prompt_part_2"), "utf8");
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

    const gstNumber = await getGST(base64Image, supplier);

    console.log("4o GST Number:", gstNumber);

    const [response1, response2] = await Promise.all([
      invokeLLM(
        promptContent1,
        base64Image,
        mimeType.split("/")[1],
        supplier ? instructionsSupplierBill : instructionsOwnBill
      ),
      invokeLLM(
        promptContent2,
        base64Image,
        mimeType.split("/")[1],
        supplier ? instructionsSupplierBill : instructionsOwnBill
      )
    ]);

    response1.company.gst_number = gstNumber;

    const combinedResponse = {
      ...response1,
      ...response2
    };

    res.json(combinedResponse);
  } catch (error) {
    console.error(`Failed to process the file. Error: ${error.message}`);
    res.status(500).json({ error: `Failed to process the file. Error: ${error.message}` });
  }
});

// Function to invoke Bedrock's LLM
async function invokeLLM(prompt, base64Image, mimeType, instructions) {
  // Validate inputs
  if (!base64Image) {
    throw new Error("Missing Base64-encoded image data.");
  }

  if (!prompt) {
    throw new Error("Missing prompt content.");
  }

  const params = {
    modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
    messages: [
      {
        role: "user",
        content: [
          {
            text: prompt
          },
          {
            image: {
              format: mimeType,
              source: {
                bytes: Buffer.from(base64Image, "base64")
              }
            }
          }
        ]
      }
    ],
    inferenceConfig: {
      maxTokens: 3500,
      temperature: 0.5,
      topP: 0.95
    },
    system: [
      {
        text: instructions
      }
    ]
  };

  try {
    const response = await bedrockRuntime.converse(params).promise();
    const responseBody = response.output.message.content[0].text;
    return JSON.parse(responseBody);
  } catch (error) {
    console.error("Error invoking Bedrock model:", error);
    throw new Error("Failed to invoke Bedrock model.");
  }
}

async function convertPdfToImage(fileBuffer) {
  try {
    const { pdf } = await import("pdf-to-img");
    const document = await pdf(fileBuffer, { scale: 2.0 });

    const imageBuffer = await document.getPage(1);

    // Convert the image buffer to a Base64 string
    const base64Image = imageBuffer.toString("base64");

    fs.unlinkSync("temp.png");
    return base64Image;
  } catch (error) {
    console.error("Error converting PDF to image:", error);
    throw error;
  }
}

module.exports = router;
