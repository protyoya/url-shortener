const urlModel = require("../model/urlSchema");
const validUrl = require("valid-url");
const uniqueString = require("../utils/utils");
const dbConnect = require("../config/dbConnect");
const trackEvent = require("../config/mixpanel");
const verifyURL = require("../middlewares/url");

require("dotenv").config();

const getSpecificUrl = async (req, res) => {
  try {
    // Destructure shortId from request parameters
    const { shortId } = req.params;

    // Connect to the database
    await dbConnect();

    // Find URL data based on shortId
    const urlData = await urlModel.findOne({ shortId });

    if (!urlData) {
      return res.status(301).redirect(`${process.env.CLIENT_PROD_URL}/404`);
    }

    // Retrieve the original URL from the database
    const originalUrl = urlData?.originalUrl;

    // If original URL is found, redirect to it
    if (originalUrl) {
      return res.redirect(originalUrl);
    } else {
      // If original URL is not found, send 404 status
      return res.status(404).send("URL not found");
    }
  } catch (error) {
    // Handle any errors that occur during the process
    console.log(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Define asynchronous function to create a short URL
const createUrl = async (req, res) => {
  // Retrieve original URL from request body
  const { originalUrl } = req.body;

  // Validate the original URL
  if (validUrl.isUri(originalUrl)) {
    try {
      await dbConnect();
      // Check if the URL already exists in the database
      const urlExist = await urlModel.findOne({ originalUrl });
      const userId = req.userId;
      // If the URL exists, return the existing shortId
      if (urlExist) {
        const shortId = urlExist.shortId;
        const shortenedURL = `${process.env.REDIRECT_URL}/${shortId}`;

        // track event
        trackEvent("Existing URL", shortenedURL);

        return res.status(201).json(shortenedURL);
      } else {
        // verify the URL
        const isURLVerified = await verifyURL(originalUrl);

        if (isURLVerified) {
          // If the URL does not exist, generate a new shortId and save the URL to the database
          const shortId = uniqueString.generateBase62String();
          const newUrl = new urlModel({
            userId,
            originalUrl,
            shortId,
          });

          // Save the new URL to the database
          await newUrl.save();

          // track event
          trackEvent("New URL shortened", originalUrl);

          // Send the newly created short URL to the client
          return res.status(201).json(`${process.env.REDIRECT_URL}/${shortId}`);
        } else {
          return res.status(400).json("URL is not valid");
        }
      }
    } catch (error) {
      // Handle any errors that occur during the process
      console.log(error);
      return res.status(500).json({ message: "Internal server error" });
    }
  } else {
    // If the original URL is not valid, send a 400 status
    return res.status(400).json("URL is not valid");
  }
};

module.exports = {
  getSpecificUrl,
  createUrl,
};
