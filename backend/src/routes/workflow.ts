import express from 'express';

const router = express.Router();

const deprecationPayload = {
  success: false,
  deprecated: true,
  error: 'Workflow REST endpoints are deprecated. Save workflow JSON in the frontend and execute via Socket.io execute-workflow.'
};

router.use((req, res) => {
  res.status(410).json(deprecationPayload);
});

export default router;
