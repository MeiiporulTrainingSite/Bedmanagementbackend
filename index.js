const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const app = express();

const mongoUrl = process.env.MONGO_URL;

mongoose.connect(mongoUrl);

const con = mongoose.connection;
con.on('open', () => {
  console.log("db is connected");
});

app.use(express.json());

// Import and use your router files
const alienrouter = require('./router/Beds');
app.use('/', alienrouter);

app.listen(process.env.PORT || 9000, () => {
  console.log('Server is running'); // Confirm that the server is running
});
