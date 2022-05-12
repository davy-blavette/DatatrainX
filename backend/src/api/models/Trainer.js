let mongoose = require("mongoose");
let trainerSchema = mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  author: {
    type: String,
    required: true
  },
  created: {
    type: Date,
    default: Date.now()
  }
});

let Trainer = mongoose.model("Trainer", trainerSchema);
module.exports = Trainer;
