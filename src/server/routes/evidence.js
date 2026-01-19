const express = require("express");
const path = require("path");
const fs = require("fs");
const config = require("../../utils/config");

const router = express.Router();

router.get("/*", (req, res) => {
  const relPath = req.params[0];
  if (!relPath) {
    return res.status(404).render("error", {
      title: "Not found",
      message: "Evidence not found."
    });
  }

  const basePath = path.resolve(config.storagePath);
  const fullPath = path.resolve(basePath, relPath);

  if (!fullPath.startsWith(basePath)) {
    return res.status(400).render("error", {
      title: "Invalid path",
      message: "Invalid evidence path."
    });
  }

  if (!fs.existsSync(fullPath)) {
    return res.status(404).render("error", {
      title: "Not found",
      message: "Evidence not found."
    });
  }

  if (path.extname(fullPath).toLowerCase() === ".html") {
    res.type("text/plain");
  }

  return res.sendFile(fullPath);
});

module.exports = router;

