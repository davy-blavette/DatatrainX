const { Schema } = require("mongoose");

const expressionSchema =  new Schema({
    x: {
        type: Date,
        default: Date.now()
    },
    y: {
        type: String,
        required: false
    }
});

