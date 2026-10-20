import { Router, type IRouter } from "express";
import healthRouter from "./health";
import jobsRouter from "./jobs";
import meRouter from "./me";
import applicationsRouter from "./applications";
import messagesRouter from "./messages";

const router: IRouter = Router();

router.use(healthRouter);
router.use(jobsRouter);
router.use(meRouter);
router.use(applicationsRouter);
router.use(messagesRouter);

export default router;
