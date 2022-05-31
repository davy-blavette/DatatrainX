const express = require("express");
const router = express.Router();
const trainerController = require("../controllers/trainerController");

router.get("/", trainerController.allTrainer);
router.post("/", trainerController.assTrainer);
//router.delete("/:trainerId", trainerController.deleteTrainer);
router.put("/dataExpression/:trainerId", trainerController.pushExpressionTrainer);
router.put("/dataCondition/:trainerId", trainerController.pushConditionTrainer);
router.put("/dataProfil/:trainerId", trainerController.updateProfilTrainer);
module.exports = router;
