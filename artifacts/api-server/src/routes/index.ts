import { Router, type IRouter } from "express";
import healthRouter from "./health";
import colabRouter from "./colab";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(colabRouter);
router.use(aiRouter);

export default router;
