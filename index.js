require('dotenv').config();
const express = require('express');
const PORT = process.env.PORT || 3000;
const { handler } = require("./controller");

const app = express();
app.use(express.json());

app.post("*", async (req, res) => {
    console.log("Received POST request:", req.body);
    await handler(req);
    res.send("OK");
});

app.get("*", async (req, res) => {
    console.log("Received GET request:", req.body);
    await handler(req);
    res.send("OK");
});

app.listen(PORT, function (err) {
    if (err) console.log(err);
    console.log("Server listening on PORT", PORT);
});