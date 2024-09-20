const router = require("express").Router();

const { default: axios } = require("axios");
// const { createCanvas, registerFont } = require("canvas");
const fs = require("fs");
const sharp = require("sharp");

const fontPath = "GreatVibes-Regular.ttf";
// registerFont(fontPath, { family: "GreatVibes" });

// router.post("/sign", (req, res) => {
//   const canvas = createCanvas(300, 110);
//   const ctx = canvas.getContext("2d");

//   // Set the canvas background to transparent (default, so no need to set explicitly)
//   ctx.clearRect(0, 0, canvas.width, canvas.height);

//   // Set the font style for the signature
//   ctx.font = '56px "GreatVibes"'; // Use the custom cursive font
//   ctx.textAlign = "center";
//   ctx.textBaseline = "middle";

//   // Add a text shadow for a more realistic effect
//   ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
//   ctx.shadowOffsetX = 3;
//   ctx.shadowOffsetY = 3;
//   ctx.shadowBlur = 5;

//   // Set text color to black
//   ctx.fillStyle = "#000000";

//   // Draw the text (name) on the canvas
//   ctx.fillText(req.body.name, canvas.width / 2, canvas.height / 2); // Replace 'Your Name Here' with actual text

//   // Save the canvas image as a PNG file with a transparent background
//   const buffer = canvas.toBuffer("image/png");
//   fs.writeFileSync("sign.png", buffer);

//   res.json({ message: "Signature created successfully." });
// });

router.post("/logo", async (req, res) => {
  const { prompt } = req.body;

  const mysResponse = await axios.post(
    "https://api.niocard.in/api/generateImage",
    {
      prompt: prompt
    },
    {
      headers: {
        client: "android",
        "device-id": "UE1A.230829.036.A4",
        "client-version": "27",
        "Content-Type": "application/json",
        Authorization:
          "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI2NWM1Nzk1OTMxN2MyZDc4OTQwZjQyMDYiLCJleHAiOjE3NTgyODAzMTMsInVzZXJJZCI6IjY1YzU3OTU5MzE3YzJkNzg5NDBmNDIwNiJ9.M9tbCMIDGcaxxAWIbHs8QIqMdt9E-yr2TnEziYlWRXc"
      }
    }
  );

  try {
    res.status(200).json({ url: mysResponse.data.url });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching image");
  }
});

router.post("/logo-file", async (req, res) => {
  const { url } = req.body;
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const contentType = response.headers["content-type"];
  res.set("Content-Type", contentType);
  res.send(response.data);
});

module.exports = router;
