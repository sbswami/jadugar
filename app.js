const express = require("express");
const dotenv = require("dotenv");
const cors = require('cors');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
app.use(cors())

app.use(express.json());

app.use("/", require("./routes/aws"));
app.use("/", require("./routes/assets"));

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
