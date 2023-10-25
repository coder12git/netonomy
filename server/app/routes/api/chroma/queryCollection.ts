import { Router } from "express";
import Joi from "joi";
import chromaClient from "../../../config/chomaClient.js";
import { OpenAIEmbeddingFunction } from "chromadb";
import openai from "../../../config/openai.js";

const requestSchema = Joi.object({
  collectionName: Joi.string().required(),
  queryTexts: Joi.array().required(),
  did: Joi.string().required(),
  recordId: Joi.string().optional(),
  nResults: Joi.number().optional(),
});

/**
 * @swagger
 * /api/chroma/queryCollection:
 *   post:
 *     description: Create a new collection
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               collectionName:
 *                 type: string
 *               queryTexts:
 *                 type: array
 *                 items:
 *                   type: string
 *               did:
 *                 type: string
 *               recordId:
 *                 type: string
 *               nResults:
 *                 type: number
 *     responses:
 *       200:
 *         description: OK
 *     tags:
 *       - Chroma
 */
export default Router({ mergeParams: true }).post(
  "/chroma/queryCollection",
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

      let { collectionName, queryTexts, did, recordId, nResults } = req.body;

      nResults = nResults || 10;

      const collection = await chromaClient.getCollection({
        name: collectionName,
      });

      if (!collection)
        return res.status(400).json({
          status: "FAILED",
          message: "Failed to get collection",
        });

      let queryEmbeddings = [];
      for (const queryText of queryTexts) {
        const queryEmbedding = await openai.embeddings.create({
          input: queryText,
          model: "text-embedding-ada-002",
        });
        queryEmbeddings.push(queryEmbedding.data[0].embedding);
      }

      const results = await collection.query({
        nResults,
        queryEmbeddings,
        where: {
          $and: [{ did: { $eq: did } }, { recordId: { $eq: recordId } }],
        },
      });

      return res.json(results);
    } catch (err) {
      console.error(err);

      return res.json({
        status: "FAILED",
        message: err as any,
      });
    }
  }
);
