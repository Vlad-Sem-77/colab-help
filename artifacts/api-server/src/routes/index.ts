import { Router, type IRouter } from "express";
import healthRouter from "./health";
import colabRouter from "./colab";
import historyRouter from "./history";

const router: IRouter = Router();

router.use(healthRouter);
router.use(colabRouter);
router.use(historyRouter);

export default router;
