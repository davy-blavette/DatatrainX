let mongoose = require("mongoose");
const Trainer = require("../models/Trainer");

//list all trainer
exports.allTrainer = async (req, res) => {
  try {
    let posts = await Trainer.find();
    res.status(200).json(posts);
  } catch (err) {
    res.status(500).json(err);
  }
};

//save trainer
exports.assTrainer = async (req, res) => {
  try {
    const trainer = new Trainer({
      token: req.body.token
    });
    let newTrainer = await trainer.save();
    res.status(200).json({ data: newTrainer });
  } catch (err) {
    res.status(500).json({ error: err });
  }
  console.log("New trainer");
};

//delete trainer
exports.deleteTrainer = async (req, res) => {
  try {
    const id = req.params.trainerId; //params yg di routes :trainerId
    let result = await Trainer.remove({ _id: id });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json(err);
  }
};

//update trainer
exports.updateTrainer = async (req, res) => {
  try {
    const id = req.params.trainerId;
    let result = await Trainer.findByIdAndUpdate(id, req.body);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json(err);
  }
};

//update kolb expressions
exports.updateTrainerKolb = async (req, res) => {
  try {
    const id = req.params.trainerId;
    let result = await Trainer.findByIdAndUpdate(id, req.body);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json(err);
  }
};
