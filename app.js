const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const google = require("googlethis");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

app.get("/v1/search", async (req, res) => {
  const keyword = decodeURIComponent(req.query.q);

  if (!keyword) {
    return res.status(400).json({
      error: 'The query parameter "q" is required.',
    });
  }

  console.log(`Searching for ${keyword}...`);

  const searchResults = await searchByKeyword(keyword);

  return res.status(200).json(searchResults);
});

app.post("/v1/cnbc", async (req, res) => {
  const link = req.body.link.replace(/('|")/g, "").trim();

  if (!link) {
    return res.status(400).json({
      error: 'The request body must contain a "link" property.',
    });
  }

  console.log(`Getting article from ${link}...`);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(link);

  const articleBodySelector =
    'div.ArticleBody-articleBody[id="RegularArticle-ArticleBody-5"]';

  const articleBodyContent = await page.evaluate((selector) => {
    const articleBody = document.querySelector(selector);
    let markdown = "";

    if (articleBody) {
      const childNodes = articleBody.querySelectorAll(
        "div.group, h2.ArticleBody-subtitle"
      );

      childNodes.forEach((node) => {
        if (
          node.nodeName.toLowerCase() === "div" &&
          node.classList.contains("group")
        ) {
          const groupChildren = node.querySelectorAll("p, span, a");
          groupChildren.forEach((child) => {
            if (child.nodeName.toLowerCase() === "a") {
              markdown += `${child.textContent}`;
            } else {
              markdown += `${child.textContent}\n\n`;
            }
          });
        } else if (node.nodeName.toLowerCase() === "h2") {
          markdown += `## ${node.textContent}\n\n`;
        }
      });
    }

    markdown = markdown.replace(/\n+/g, "\n\n");

    return markdown;
  }, articleBodySelector);

  await browser.close();

  const articleBodyChunks = articleBodyContent
    .split("##")
    .map((chunk, index) => (index === 0 ? chunk : `##${chunk}`));

  return res.status(200).json({
    article: articleBodyChunks,
  });
});

const searchByKeyword = async (keyword) => {
  const options = {
    page: 0,
    safe: false,
    parse_ads: false,
    additional_params: {
      hl: "en",
    },
  };

  const response = await google.search(keyword, options);

  return response.results;
};

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
