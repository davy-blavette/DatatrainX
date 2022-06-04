const dataExpressionSchema = {
    FaceDetection:{
        score:{
            type: Number,
            required: true
        },
        box:{
            x: {
                type: Number,
                required: true
            },
            y: {
                type: Number,
                required: true
            },
            height: {
                type: Number,
                required: true
            },
            width: {
                type: Number,
                required: true
            }
        },
        imageDims:{
            height: {
                type: Number,
                required: false
            },
            width: {
                type: Number,
                required: false
            }
        }
    },
    FaceExpression:{
        colere: {
            type: Number,
            required: false
        },
        degout: {
            type: Number,
            required: false
        },
        peur: {
            type: Number,
            required: false
        },
        joie: {
            type: Number,
            required: false
        },
        triste: {
            type: Number,
            required: false
        },
        surprise: {
            type: Number,
            required: false
        },
        neutre: {
            type: Number,
            required: false
        },
    },
    created: {
        type: Date,
        default: Date.now()
    }
};



