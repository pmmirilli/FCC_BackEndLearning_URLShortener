require('dotenv').config();
const bodyParser = require('body-parser');
const express = require('express');
const cors = require('cors');
const app = express();

const port = process.env.PORT || 3000;

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const shortUrlSchema = new Schema({
  original_url: { type: String, required: true},
  short_url: { type: String, required: true, unique: true},
});
const ShortURL = mongoose.model('ShortURL', shortUrlSchema);

app.use(cors());

app.use('/public', express.static(`${process.cwd()}/public`));

app.use(bodyParser.urlencoded({extended: false}));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Function obtained at: https://stackoverflow.com/questions/40958727/javascript-generate-unique-number-based-on-string from Jyothi Babu Araja's reply.
const getHash = (input) => {
  var hash = 0, len = input.length;
  for (var i = 0; i < len; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash|= 0; // to 32bit integer
  }
  return hash;
}

const createShortUrl = (url) => {
  let shortUrl = getHash(url);
  shortUrl /= 10000;
  shortUrl = shortUrl % 1;
  shortUrl *= 10000;
  shortUrl = Math.floor(shortUrl);
  if (Math.sign(shortUrl) < 0) shortUrl *= -1;
  console.log("Short URL created: " + shortUrl);
  return shortUrl;
}

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (error) {
    console.log(error.message);
    return false;
  }
};

const createEntryDB = (originalUrl, shortUrl) => {
  ShortURL.create({
    original_url: originalUrl,
    short_url: shortUrl
  },
  function (error, data) {
    if (error) return error;
    if (data == null) return null;
    console.log("Created new entry:");
    console.log(data);
    return data;
  });
}

// Find object in database.
const findInDB = async (queryObject) => {
  try {
    return await ShortURL.findOne(queryObject);
  } catch(error) {
    console.log(error.message);
  }
}

// Clear database.
app.get("/api/clear", function (req, res) {
  ShortURL.deleteMany({}, function (error, data) {
    if (error) return error;
    console.log("Deleted " + data.deletedCount + " entries.");
  });
});

// Get the user input URL and create a new entry in the database, in case it doesn't already exist.
app.post("/api/shorturl", async function (req, res) {
  const originalUrl = req.body.url;
  const isValid = isValidUrl(originalUrl);
  if (!isValid) {
    console.log(originalUrl + " is NOT valid");
    res.json({ error:'invalid url' });
    return;
  }
  console.log(originalUrl + " is a valid URL");

  let shortUrl = createShortUrl(originalUrl);
  const urlExists = await findInDB({original_url: originalUrl});
  if (!urlExists) createEntryDB(originalUrl, shortUrl);

  res.json({ original_url: originalUrl, short_url: shortUrl });
});

// Get the user input short URL and redirect to original URL from the database.
app.get("/api/shorturl/:code", async function (req, res) {
  const shortUrl = req.params.code;
  const query = await findInDB({short_url: shortUrl});

  query ? res.redirect(301, query.original_url) : res.json({ error:'invalid url' });
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
