const dataExpressionSchema = require("./DataExpression");
const resultatSchema = require("./resultats/Kolb");
const mongoose = require("mongoose");
const { Schema } = require("mongoose");

const trainerSchema = new Schema({
  token: {
    type: String,
    required: true
  },
  kolb: {
    dataExpression: dataExpressionSchema,
    reponse: {
      type: Array,
      required: false
    },
    resultat: [resultatSchema],
    created: {
      type: Date,
      default: Date.now()
    }
  },
  created: {
    type: Date,
    default: Date.now()
  }
});

const Trainer = mongoose.model("Trainer", trainerSchema);

module.exports = Trainer;
