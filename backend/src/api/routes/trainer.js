const express = require("express");
const router = express.Router();
const trainerController = require("../controllers/trainerController");

router.get("/", trainerController.allTrainer);
router.post("/", trainerController.assTrainer);
router.delete("/:trainerId", trainerController.deleteTrainer);
router.put("/:trainerId", trainerController.updateTrainer);

module.exports = router;
