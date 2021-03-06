let mongoose = require("mongoose");
const Trainer = require("../models/Trainer");
const jwt = require('jsonwebtoken');

let privateKey = require("fs").readFileSync("../privkey.pem");

exports.demoTrainer = async (req, res) => {
  try {
    const id = "629d0c575f399943f104558b";
    let result = await Trainer.findById(id);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json(err);
  }
};

//result trainer
exports.resultTrainer = async (req, res) => {
  try {
    const id = req.params.trainerId;
    let result = await Trainer.findById(id);
    res.status(200).json(result);
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
    res.status(200).json({
      userId: newTrainer._id,
      token: jwt.sign(
          { userId: newTrainer._id },
          `${privateKey}`,
          { expiresIn: '24h' }
      )
    });
  } catch (err) {
    res.status(500).json({ error: err });
  }
};

//update trainer
exports.pushExpressionTrainer = async (req, res) => {
  try {
    const id = req.params.trainerId;
    await Trainer.findByIdAndUpdate(id, { $push: { dataExpression:req.body }});
    res.status(200).json({response:"pushExpressionTrainer, ok"});
  } catch (err) {
    res.status(500).json(err);
  }
};
exports.pushConditionTrainer = async (req, res) => {
  try {
    const id = req.params.trainerId;
    await Trainer.findByIdAndUpdate(id, { $push : { dataCondition: req.body }});
    res.status(200).json({response:"pushConditionTrainer, ok"});;
  } catch (err) {
    res.status(500).json(err);
  }
};
exports.updateProfilTrainer = async (req, res) => {
  try {
    const id = req.params.trainerId;
    await Trainer.findByIdAndUpdate(id, { dataProfil: req.body });
    res.status(200).json({response:"updateProfilTrainer, ok"});;
  } catch (err) {
    res.status(500).json(err);
  }
};

//delete trainer
/*
//list all trainer
exports.allTrainer = async (req, res) => {
  try {
    let result = await Trainer.find().limit(1);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json(err);
  }
};
exports.deleteTrainer = async (req, res) => {
  try {
    const id = req.params.trainerId; //params yg di routes :trainerId
    let result = await Trainer.remove({ _id: id });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json(err);
  }
};
exports.pushOneTrainer = async (req, res) => {
  try {
    const id = req.params.trainerId;
    let result = await Trainer.findByIdAndUpdate(id, req.body);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json(err);
  }
};
*/