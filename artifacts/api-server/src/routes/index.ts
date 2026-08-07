import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import syncRouter from "./sync";
import markEntriesRouter from "./mark-entries";
import timetableSlotsRouter from "./timetable-slots";
import conflictsRouter from "./conflicts";
import importsRouter from "./imports";
import smsRouter from "./sms";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/sync", syncRouter);
router.use("/mark-entries", markEntriesRouter);
router.use("/timetable-slots", timetableSlotsRouter);
router.use("/conflicts", conflictsRouter);
router.use("/imports", importsRouter);
router.use("/sms", smsRouter);

export default router;
