import { Router, type IRouter } from "express";
import healthRouter from "./health";
import colabRouter from "./colab";
import aiRouter from "./ai";
import historyRouter from "./history";

const router: IRouter = Router();

router.use(healthRouter);
router.use(colabRouter);
router.use(aiRouter);
router.use(historyRouter);

export default router;
