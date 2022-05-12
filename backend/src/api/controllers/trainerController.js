let mongoose = require("mongoose");
const Trainer = require("../models/Trainer");

exports.allTrainer = async (req, res) => {
  try {
    let posts = await Trainer.find();
    res.status(200).json(posts);
  } catch (err) {
    res.status(500).json(err);
  }
};

exports.assTrainer = async (req, res) => {
  try {
    const post = new Trainer({
      title: req.body.title,
      content: req.body.content,
      category: req.body.category,
      author: req.body.author
    });
    let newTrainer = await post.save();
    res.status(200).json({ data: newTrainer });
  } catch (err) {
    res.status(500).json({ error: err });
  }
};

exports.deleteTrainer = async (req, res) => {
  try {
    const id = req.params.trainerId; //params yg di routes :blogId
    let result = await Trainer.remove({ _id: id });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json(err);
  }
};

exports.updateTrainer = async (req, res) => {
  try {
    const id = req.params.trainerId;
    let result = await Trainer.findByIdAndUpdate(id, req.body);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json(err);
  }
};
