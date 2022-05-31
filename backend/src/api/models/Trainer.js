const dataExpressionSchema = require("./DataExpression");
const dataConditionSchema = require("./DataCondition");
const dataProfilSchema = require("./DataProfil");
const mongoose = require("mongoose");
const { Schema } = require("mongoose");

const trainerSchema = new Schema({
  token: {
    type: String,
    required: true
  },
  dataExpression: [dataExpressionSchema],
  dataCondition: [dataConditionSchema],
  dataProfil: dataProfilSchema,
  created: {
    type: Date,
    default: Date.now()
  }
});

const Trainer = mongoose.model("Trainer", trainerSchema);

module.exports = Trainer;
