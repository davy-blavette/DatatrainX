const express = require("express");
const router = express.Router();
const trainerController = require("../controllers/trainerController");
const auth = require('../middleware/auth');

router.post("/", trainerController.assTrainer);
router.get("/", trainerController.demoTrainer);
router.get("/dataProfil/:trainerId", auth, trainerController.resultTrainer);
router.put("/dataExpression/:trainerId", auth, trainerController.pushExpressionTrainer);
router.put("/dataCondition/:trainerId", auth, trainerController.pushConditionTrainer);
router.put("/dataProfil/:trainerId", auth, trainerController.updateProfilTrainer);
//router.get("/", trainerController.allTrainer);
//router.delete("/:trainerId", trainerController.deleteTrainer);
module.exports = router;
