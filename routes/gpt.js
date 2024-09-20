const axios = require("axios");
const base64 = require("base64-js");

// Configuration
const API_KEY = process.env.OPENAI_API_KEY;

const headers = {
  "Content-Type": "application/json",
  "api-key": API_KEY
};

const ENDPOINT =
  "https://flobizproduction.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2024-02-15-preview";

async function getGST(base64image, supplier = false) {
  // Payload for the request
  const payload = {
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: supplier
              ? "Treat the bill as from supplier, you have to fetch GST from billed to party, and return if and only if you find it correct, otherwise null. don't share extra information, just GST number. otherwise I will die if you share more information."
              : "Find GST number from this image, and return if and only if you find it correct, otherwise null. don't share extra information, just GST number of the business and not for any other entity etc factory or anything. otherwise I will die if you share more information."
          },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64image}` } }
        ]
      }
    ],
    temperature: 0.4,
    top_p: 1,
    max_tokens: 100
  };
  try {
    const response = await axios.post(ENDPOINT, payload, { headers });

    // Extract the choices array from the response
    const choices = response.data.choices;

    // Check if choices array exists and has content
    if (choices && choices.length > 0) {
      // Get the first choice (usually the best one)
      const firstChoice = choices[0];

      // Extract the message content from the first choice
      const messageContent = firstChoice.message.content;

      return messageContent;
    } else {
      return null;
    }
  } catch (error) {
    console.error(`Failed to process the file. Error: ${error.message}`);
    return null;
  }
}

module.exports = { getGST };
