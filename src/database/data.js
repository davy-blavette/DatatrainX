
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