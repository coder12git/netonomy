import { Router } from "express";
import Joi from "joi";
import { YoutubeLoader } from "langchain/document_loaders/web/youtube";
import vectorStore from "../../../config/vectorStore.js";

const requestSchema = Joi.object({
  url: Joi.string().required(),
  did: Joi.string().required(),
});

/**
 * @swagger
 * /api/ai/loadYoutubeVideoToMemory:
 *   post:
 *     description: Load and vectorize a youtube video to memory
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 required: true
 *               did:
 *                 type: string
 *                 required: true
 *     responses:
 *       200:
 *         description: OK
 *     tags:
 *       - Ai
 */
export default Router({ mergeParams: true }).post(
  "/ai/loadYoutubeVideoToMemory",
  async (req, res) => {
    try {
      // Validate the request body
      const { error } = requestSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          status: "FAILED",
          message: error.details[0].message,
        });
      }

      let { url, did } = req.body;

      const docs = await loadYoutubeVideoToMemory(url, did);

      res.json({ docs });
    } catch (err) {
      console.error(err);

      return res.json({
        status: "FAILED",
        message: err as any,
      });
    }
  }
);

export async function loadYoutubeVideoToMemory(url: string, did: string) {
  const loader = YoutubeLoader.createFromUrl(url, {
    language: "en",
    addVideoInfo: true,
  });

  let docs = await loader.load();
  docs = docs.map((doc) => {
    let newDoc = doc;
    newDoc.metadata = {
      ...doc.metadata,
      did: did,
    };
    return newDoc;
  });

  // Split the docs out into more docs, the pageContent property can't be too long
  docs = docs.flatMap((doc) => {
    const pageContent = doc.pageContent;
    const pageContentLength = pageContent.length;
    const maxPageContentLength = 10000;
    const maxPages = Math.ceil(pageContentLength / maxPageContentLength);

    const newDocs = [];
    for (let i = 0; i < maxPages; i++) {
      const start = i * maxPageContentLength;
      const end = (i + 1) * maxPageContentLength;
      const newDoc = {
        ...doc,
        pageContent: pageContent.substring(start, end),
      };
      newDocs.push(newDoc);
    }

    return newDocs;
  });

  await vectorStore.addDocuments(docs);

  return docs;
}
