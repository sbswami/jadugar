const router = require("express").Router();

const { createCanvas, registerFont } = require("canvas");
const fs = require("fs");
const sharp = require("sharp");

const fontPath = "GreatVibes-Regular.ttf";
registerFont(fontPath, { family: "GreatVibes" });

router.post("/", (req, res) => {
  const canvas = createCanvas(300, 110);
  const ctx = canvas.getContext("2d");

  // Set the canvas background to transparent (default, so no need to set explicitly)
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Set the font style for the signature
  ctx.font = '56px "GreatVibes"'; // Use the custom cursive font
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Add a text shadow for a more realistic effect
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  ctx.shadowBlur = 5;

  // Set text color to black
  ctx.fillStyle = "#000000";

  // Draw the text (name) on the canvas
  ctx.fillText(req.body.name, canvas.width / 2, canvas.height / 2); // Replace 'Your Name Here' with actual text

  // Save the canvas image as a PNG file with a transparent background
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync("sign.png", buffer);

  res.json({ message: "Signature created successfully." });
});

module.exports = router;
