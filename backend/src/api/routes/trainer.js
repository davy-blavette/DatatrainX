const express = require("express");
const router = express.Router();
const trainerController = require("../controllers/trainerController");

router.post("/", trainerController.assTrainer);
router.get("/", trainerController.allTrainer);
router.get("/dataProfil/:trainerId", trainerController.resultTrainer);
router.put("/dataExpression/:trainerId", trainerController.pushExpressionTrainer);
router.put("/dataCondition/:trainerId", trainerController.pushConditionTrainer);
router.put("/dataProfil/:trainerId", trainerController.updateProfilTrainer);
//router.delete("/:trainerId", trainerController.deleteTrainer);
module.exports = router;
