const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.use("/", require("./routes/aws"));
app.use("/sign", require("./routes/sign"));

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
