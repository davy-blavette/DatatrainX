import {kolbReponse} from "./data";

export let questions = [
    [
        "Lorsque je fais face à un problème",
        "Je prends du recul pour évaluer la situation et les différentes avenues possibles pour résoudre le problème.",
        "je saute tout de suite sur le problème et travaille pour trouver une solution."
    ],
    [
        "Lorsque j’apprends",
        "J’aime participer et agir.",
        "J’aime observer."
    ],
    [
        "Lorsque je reçois une information qui demande une action",
        "Je prends le temps de l’analyser et je détermine quelle action est la plus appropriée.",
        "Je réalise l’action immédiatement."
    ],
    [
        "J’apprends mieux",
        "Lorsque que j’ai la chance de mettre la théorie en pratique et de m’entraîner.",
        "En regardant les autres."
    ],
    [
        "Lorsque je rencontre de nouvelles personnes",
        "Je les observe et tente de cerner leurs traits de personnalité.",
        "J’interagis activement avec eux et leur pose des questions."
    ],
    [
        "J’apprends mieux lorsque",
        "Je peux expérimenter.",
        "Je peux regarder et comprendre la situation."
    ],
    [
        "Quand je suis en formation et que j’ai des travaux à réaliser, je préfère",
        "Prendre le temps de planifier comment je vais les réaliser.",
        "Les commencer immédiatement."
    ],
    [
        "En situation d’apprentissage",
        "J’aime mettre la leçon en pratique.",
        "J’examine toutes les facettes du problème."
    ],
    [
        "Lorsque plusieurs possibilités s’offrent à moi",
        "J’analyse les conséquences de chacune avant de prendre une décision.",
        "Je sélectionne celle qui me semble la meilleure et la mets en application."
    ],
    [
        "En groupe",
        "Je me porte souvent responsable.",
        "Je suis plutôt calme et réservé."
    ],
    [
        "Lorsque j’apprends",
        "J’aime observer et écouter.",
        "J’aime accomplir des tâches."
    ],
    [
        "Après avoir répondu aux onze questions précédentes",
        "Je veux poursuivre pour rapidement compléter le reste du questionnaire.",
        "Je me questionne sur l’interprétation des résultats et j’aimerais comprendre le sens de mes réponses avant de poursuivre."
    ],
    [
        "Habituellement, lorsque j’apprends quelque chose",
        "Je prends le temps d’y penser.",
        "Je le fais sans y penser."
    ],
    [
        "J’apprends mieux lorsque",
        "Je suis réceptif et garde l’esprit ouvert.",
        "J’analyse les idées qui sont présentées."
    ],
    [
        "Si je dois enseigner comment faire quelque chose",
        "Je donne des explications théoriques.",
        "Je fais une démonstration de ce qu’il faut faire."
    ],
    [
        "Mes décisions sont généralement meilleures lorsque",
        "Je fais confiance à mon intuition et à mes émotions.",
        "Je me base sur un raisonnement logique."
    ],
    [
        "Si j’ai une présentation orale à faire devant un groupe de personnes",
        "Je me suis préparé et je sais exactement ce que je vais dire.",
        "Je connais les grandes lignes de ma présentation et je me laisse guider par les réactions et les discussions du groupe. "
    ],
    [
        "Lorsque j’apprends",
        "Je suis ouvert à de nouvelles expériences.",
        "J’aime analyser et disséquer le sujet."
    ],
    [
        "Si je suis en réunion avec plusieurs experts sur un domaine",
        "Je leur demande, à tour de rôle, leur opinion respective.",
        "Je discute activement avec eux et cherche à faire partager les idées et les sentiments de chacun."
    ],
    [
        "En cours d’apprentissage",
        "Je me sers de mon intuition.",
        "Je raisonne de façon logique."
    ],
    [
        "Lorsque je deviens impliqué émotivement dans une situation",
        "Je cherche à contrôler mes sentiments et essaie d’analyser la situation.",
        "Je me laisse guider par mes émotions."
    ],
    [
        "J’apprends mieux",
        "En interagissant avec d’autres personnes.",
        "En me basant sur des lectures et des concepts rationnels."
    ],
    [
        "Pour moi, la façon la plus efficace pour apprendre quelque chose, c’est",
        "De lire un livre, de suivre un cours.",
        "De discuter avec diverses personnes, d’expérimenter et d’apprendre de mes erreurs."
    ],
    [
        "Lorsque je prends une décision",
        "Je me base sur mon intuition et mes émotions.",
        "Je me base sur mes idées."
    ]
];

function calcul(){

    let c1 = 0;
    let c2 = 0;
    let c3 = 0;
    let c4 = 0;
    let dimension1 = 0;
    let dimension2 = 0;
    let profil = "";
    let reponse = ["B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B"];


    if(kolbReponse.length == 0){
        reponse = ["B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B","B"];
    }

    for (let i = 0; i < reponse.length; i++) {
        if (i%2 == 0) {
            if (i < 12) {
                if(reponse[i] == "A"){
                    c1++;
                }
            } else {
                if(reponse[i] == "B"){
                    c3++;
                }
            }
        } else{
            if (i < 12) {
                if(reponse[i] == "B"){
                    c2++;
                }
            } else {
                if(reponse[i] == "A"){
                    c4++;
                }
            }
        }

        //console.log(`${i}${i%2}-${reponse[i]} c1 ${c1} c2 ${c2} c3 ${c3} c4 ${c4}`);
    }

    dimension1 = c1 + c2;
    dimension2 = c3 + c4;

    if(dimension1 <= 6 && dimension2 >= 6){
        profil += "ADAPTATEUR";
    }
    if(dimension1 >= 6 && dimension2 >= 6){
        if(profil.length){
            profil += " - ";
        }
        profil += "DIVERGEUR";
    }
    if(dimension1 >= 6 && dimension2 <= 6){
        if(profil.length){
            profil += " - ";
        }
        profil += "ASSIMILATEUR";
    }
    if (dimension1 <= 6 && dimension2 <= 6){
        if(profil.length){
            profil += " - ";
        }
        profil = "CONVERGEUR";
    }
}
