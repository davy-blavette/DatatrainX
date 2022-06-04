
export const baseUrl = "https://datatrainx.akairnet.fr:4000/trainer";
export let kolbReponse = [];
export let dataExpression = [];

export let dataProfil = {
    activist:0,
    reflector:0,
    theorist:0,
    pragmatist:0
};
export let FaceDetection = {
    score:"",
    box:{
        height: "",
        width: "",
        x: "",
        y: ""
    },
    imageDims: {
        height: "",
        width: ""
    },
    image:""
};
export let FaceExpression = {
    colere:"",
    degout:"",
    peur:"",
    joie:"",
    triste:"",
    surprise:"",
    neutre:""
};
export let streamExpression = {
    colere:[],
    degout:[],
    peur:[],
    joie:[],
    triste:[],
    surprise:[],
    neutre:[]
};

let border = 1;
let radius = 0;
export let dataStream = {
    datasets: [
        {
            label: "Colère",
            backgroundColor: "#FF6B6B",
            borderColor: "#FF6B6B",
            cubicInterpolationMode: "monotone",
            borderWidth: border,
            radius: radius,
            data: streamExpression.colere,
        },
        {
            label: "Dégoût",
            backgroundColor: "#FFD93D",
            borderColor: "#FFD93D",
            cubicInterpolationMode: "monotone",
            borderWidth: border,
            radius: radius,
            data: streamExpression.degout,
        },
        {
            label: "Peur",
            backgroundColor: "#6BCB77",
            borderColor: "#6BCB77",
            cubicInterpolationMode: "monotone",
            borderWidth: border,
            radius: radius,
            data: streamExpression.peur,
        },
        {
            label: "Joie",
            backgroundColor: "#4D96FF",
            borderColor: "#4D96FF",
            cubicInterpolationMode: "monotone",
            borderWidth: border,
            radius: radius,
            data: streamExpression.joie,
        },
        {
            label: "Triste",
            backgroundColor: "#AB46D2",
            borderColor: "#AB46D2",
            cubicInterpolationMode: "monotone",
            borderWidth: border,
            radius: radius,
            data: streamExpression.triste,
        },
        {
            label: "Surprise",
            backgroundColor: "#FF6FB5",
            borderColor: "#FF6FB5",
            cubicInterpolationMode: "monotone",
            borderWidth: border,
            radius: radius,
            data: streamExpression.surprise,
        }
    ],
};
export let chartLabels = ['Concret', 'Analytique', 'Abstrait', 'Proactif'];

export let userToken = generate_token(16);

function generate_token(length){
    //edit the token allowed characters
    let a = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890".split("");
    let b = [];
    for (let i=0; i<length; i++) {
        let j = (Math.random() * (a.length-1)).toFixed(0);
        b[i] = a[j];
    }
    return b.join("");
}