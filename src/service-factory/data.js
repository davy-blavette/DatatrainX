
export const baseUrl = "https://datatrainx.akairnet.fr:4000/trainer";
export let kolbReponse = [];
export let dataExpression = [];
export let chartLabels = [['Concret','Ressentir', 'Activist'], ['Analytique','Observer','Reflector'], ['Abstrait','Réfléchir','Theorist'], ['Proactif','Pratiquer','Pragmatist']];
export let expressionLabels = ['Colère', 'Dégoût', 'Peur', 'Joie', 'Triste', 'Surprise'];
export let kolbProfil = {
    adaptateur:['activist','pragmatist'],
    convergeur:['pragmatist','theorist'],
    assimilateur:['theorist','reflector'],
    divergeur:['reflector','activist'],
};
export let scoreTab = [
    {
        score:5,
        tab:[0, 80]
    },
    {
        score:4,
        tab:[0, 40]
    },
    {
        score:3,
        tab:[-20, 20]
    },
    {
        score:2,
        tab:[0, -40]
    },
    {
        score:1,
        tab:[0, -80]
    },
];
export let preferenceProfil = {
    activist:{
        veryStrong:13,
        strong:11,
        moderate:7,
        low:4,
        veryLow:0
    },
    reflector:{
        veryStrong:18,
        strong:15,
        moderate:12,
        low:9,
        veryLow:0
    },
    theorist:{
        veryStrong:16,
        strong:14,
        moderate:11,
        low:8,
        veryLow:0
    },
    pragmatist:{
        veryStrong:17,
        strong:15,
        moderate:12,
        low:9,
        veryLow:0
    }
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
export let chartExpressions = {
    colere:{
        label:expressionLabels[0],
        color:"#FF6B6B"
    },
    degout:{
        label:expressionLabels[1],
        color:"#ffe08a"
    },
    peur:{
        label:expressionLabels[2],
        color:"#48c774"
    },
    joie:{
        label:expressionLabels[3],
        color:"#3298dc"
    },
    triste:{
        label:expressionLabels[4],
        color:"#AB46D2"
    },
    surprise:{
        label:expressionLabels[5],
        color:"#FF6FB5"
    }
};
let border = 1;
let radius = 0;
export let dataStream = {datasets: []};
export let resultatExpressions = {};

for (const [expression, value] of Object.entries(chartExpressions)) {
    dataStream.datasets.push(
        {
            label: chartExpressions[expression].label,
            backgroundColor: chartExpressions[expression].color,
            borderColor: chartExpressions[expression].color,
            cubicInterpolationMode: "monotone",
            borderWidth: border,
            radius: radius,
            data: streamExpression[expression],
        }
    );
    Object.assign(resultatExpressions, {
        [expression]:{
            count:0,
            best:0,
            total:0,
            ratio:0,
            image:"",
            key:0,
            utils:chartExpressions[expression]}
    });
}

export let dataProfil = {
    apprenant:{
        dim1:{
            activist: {
                scoreRacine:0,
                score:0,
                tab:[]
            },
            reflector: {
                scoreRacine:0,
                score:0,
                tab:[]
            },
            theorist: {
                scoreRacine:0,
                score:0,
                tab:[]
            },
            pragmatist: {
                scoreRacine:0,
                score:0,
                tab:[]
            }
        },
        dim2:{
            adaptateur:0,
            divergeur:0,
            assimilateur:0,
            convergeur:0,
        },
        profil:"",
        score:0
    },
    expressions:{
        resultatExpressions,
        score:0
    }
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