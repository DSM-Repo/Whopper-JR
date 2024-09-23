const PORT = 3005; // 서버 포트
const TIMEOUT = 1000 * 60; // PDF 변환 타임아웃 시간
const PDFOPTION = {
  // Puppeteer PDF 옵션
  path: "resume.pdf",
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
};
const VIEWPORT = {
  // Puppeteer 뷰포트
  width: 842,
  height: 1191,
};

const url = `${process.env.SERVICE_URL}/${req.body.grade}`;

const puppeteer = require("puppeteer");
const { config } = require("dotenv");
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");

// 서버 기본 설정
config();
app.use(cors());
const app = express();
app.use(express.json({ extended: true }));

app.post("/all", async (req, res) => {
  try {
    if (!!!req.headers.authorization) {
      res.status(403);
      res.json({ message: "토큰이 필요합니다" });
      return;
    }
    if (!!!req.body || !!!req.body.grade) {
      res.status(404);
      res.json({ message: "학년이 필요합니다" });
      return;
    }

    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--disable-setuid-sandbox",
      ],
    });

    const page = await browser.newPage();
    page.setViewport(VIEWPORT);

    await page.setCookie([
      {
        name: "access_token",
        value: req.headers.authorization.split(" ")[1],
        domain: ".localhost",
      },
      {
        name: "role",
        value: "teacher",
        domain: ".localhost",
      },
    ]);

    await page.goto(url, {
      waitUntil: ["networkidle0", "load"],
      timeout: TIMEOUT,
    });

    const data = {
      index: await page.evaluate(() =>
        Array.from(document.querySelectorAll("span.section"))?.map((i) => {
          const section = i.innerHTML.split("_");
          return {
            name: section[1],
            student_number: Number(section[2]),
            page_number: Number(section[0]),
            major: section[3],
          };
        })
      ),
    };

    await page.emulateMediaType("screen");
    await page.pdf(PDFOPTION);
    await browser.close();

    const form = new FormData();

    form.append(
      "pdf",
      new File([fs.readFileSync("./resume.pdf")], "resume.pdf")
    );
    form.append(
      "index",
      new Blob([JSON.stringify(data)], { type: "application/json" })
    );

    axios
      .post(`${process.env.API_URL}/library?grade=${req.body.grade}`, form, {
        headers: { authorization: req.headers.authorization },
      })
      .then(() => {
        res.status(200);
        res.json({ message: "Successed" });
      });
  } catch (err) {
    res.status(500);
    res.json({ message: err.message || "Error occured" });
  }
});

app.listen(PORT, () => console.log(`서버가 ${PORT}에서 가동되고 있습니다`));
