const express = require("express");
const router = express.Router();
const trainerController = require("../controllers/trainerController");

router.get("/", trainerController.allTrainer);
router.post("/", trainerController.assTrainer);
//router.delete("/:trainerId", trainerController.deleteTrainer);
router.put("/kolb/:trainerId", trainerController.updateTrainerKolb);

module.exports = router;
