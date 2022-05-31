const { Schema } = require("mongoose");

const expressionSchema =  new Schema({
    y: {
        type: String,
        required: false
    },
    x: {
        type: Date,
        default: Date.now()
    }
});

