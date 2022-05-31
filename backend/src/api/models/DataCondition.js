const dataProfilSchema = require("./DataProfil");

const dataConditionSchema = {
    ref: {
        type: Number,
        required: false
    },
    dataProfil: dataProfilSchema,
    created: {
        type: Date,
        default: Date.now()
    }
};