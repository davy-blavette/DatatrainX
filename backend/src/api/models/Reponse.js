const { Schema } = require("mongoose");

const reponseSchema =  new Schema({
    value: {
        type: String,
        required: false
    },
    date: {
        type: Date,
        default: Date.now()
    }
});

