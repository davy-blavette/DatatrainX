const { Schema } = require("mongoose");

const resultatSchema =  new Schema({
    profil: {
        type: String,
        required: false
    },
    score: {
        type: String,
        required: false
    }
});

